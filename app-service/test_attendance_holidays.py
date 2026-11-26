"""Coordinator holidays: validation, batch ownership, absence clean-up and audit."""
from datetime import date
from unittest import TestCase
from unittest.mock import MagicMock, patch
import mysql.connector
from fastapi import HTTPException
from pydantic import ValidationError
import attendance_holidays as module
from test_coordinator_auth import database_for

COORDINATOR={'id':8}


def calls(cursor,fragment):
    return [call.args for call in cursor.execute.call_args_list if fragment in call.args[0]]


def holiday(**changes):
    values=dict(classCode='BATCH',date='2026-12-25',name='Christmas Day',type='Regular holiday')
    values.update(changes)
    return module.Holiday(**values)


class ValidationTests(TestCase):
    def test_every_ui_kind_is_accepted_and_the_name_is_trimmed(self):
        for kind in module.KINDS:
            self.assertEqual(holiday(type=kind).type,kind)
        self.assertEqual(holiday(name='  Founders Day  ').name,'Founders Day')

    def test_bad_input_is_rejected(self):
        for changes in (dict(type='Birthday'),dict(date='2026-02-30'),dict(date='12/25/2026'),dict(date='1999-12-25'),
                        dict(date='2101-01-01'),dict(name='   '),dict(classCode='')):
            with self.subTest(changes),self.assertRaises(ValidationError):
                holiday(**changes)


class ListingTests(TestCase):
    def test_only_the_owning_coordinator_can_list_a_batch(self):
        cursor=MagicMock()
        cursor.fetchone.return_value=None
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as caught:
            module.holidays('OTHER',COORDINATOR)
        self.assertEqual(caught.exception.status_code,404)
        self.assertEqual(calls(cursor,'FROM attendance_holidays'),[])

    def test_listing_returns_dates_names_and_kinds_in_order(self):
        cursor=MagicMock()
        cursor.fetchone.return_value={'code':'BATCH'}
        cursor.fetchall.return_value=[dict(holiday_date=date(2026,11,30),name='Bonifacio Day',kind='Regular holiday'),
                                      dict(holiday_date=date(2026,12,25),name='Christmas Day',kind='Regular holiday')]
        with patch.object(module,'database',lambda:database_for(cursor)):
            result=module.holidays('BATCH',COORDINATOR)
        self.assertEqual(result['holidays'][0],dict(date='2026-11-30',name='Bonifacio Day',type='Regular holiday'))
        self.assertIn('ORDER BY holiday_date',calls(cursor,'FROM attendance_holidays')[0][0])
        self.assertEqual(calls(cursor,'FROM attendance_holidays')[0][1],('BATCH',))


class AddTests(TestCase):
    def add(self,owned=True,fail=None):
        cursor=MagicMock()
        cursor.fetchone.return_value={'code':'BATCH'} if owned else None
        if fail:
            def execute(sql,args=()):
                if 'INSERT INTO attendance_holidays' in sql:
                    raise fail
            cursor.execute.side_effect=execute
        with patch.object(module,'database',lambda:database_for(cursor)):
            result=module.add(holiday(),COORDINATOR)
        return cursor,result

    def test_adding_saves_the_day_clears_unreviewed_absences_and_audits(self):
        cursor,result=self.add()
        self.assertEqual(result,{'ok':True})
        self.assertEqual(calls(cursor,'INSERT INTO attendance_holidays')[0][1],('BATCH','2026-12-25','Christmas Day','Regular holiday',8))
        cleanup=calls(cursor,'DELETE a FROM attendance_absences')[0]
        self.assertIn("a.review=''",cleanup[0])  # reviewed absences are left alone
        self.assertEqual(cleanup[1],('BATCH','2026-12-25'))
        self.assertEqual(calls(cursor,'audit_events')[0][1],
                         ('BATCH','coordinator',8,0,'holiday-2026-12-25','Added holiday: Christmas Day (regular holiday)','Success'))

    def test_another_coordinators_batch_cannot_be_changed(self):
        cursor=MagicMock()
        cursor.fetchone.return_value=None
        with patch.object(module,'database',lambda:database_for(cursor)),self.assertRaises(HTTPException) as caught:
            module.add(holiday(),COORDINATOR)
        self.assertEqual(caught.exception.status_code,404)
        self.assertEqual(calls(cursor,'INSERT INTO attendance_holidays'),[])

    def test_the_same_date_cannot_be_added_twice(self):
        with self.assertRaises(HTTPException) as caught:
            self.add(fail=mysql.connector.IntegrityError(msg='Duplicate entry',errno=1062))
        self.assertEqual(caught.exception.status_code,409)

    def test_other_database_errors_are_not_hidden(self):
        with self.assertRaises(mysql.connector.IntegrityError):
            self.add(fail=mysql.connector.IntegrityError(msg='Cannot add or update a child row',errno=1452))


class RemoveTests(TestCase):
    def remove(self,found=True,owned=True,day='2026-12-25'):
        cursor=MagicMock()
        cursor.fetchone.side_effect=[{'code':'BATCH'} if owned else None,{'name':'Christmas Day'} if found else None]
        with patch.object(module,'database',lambda:database_for(cursor)):
            module.remove('BATCH',day,COORDINATOR)
        return cursor

    def test_removing_deletes_the_day_and_audits_it(self):
        cursor=self.remove()
        self.assertEqual(calls(cursor,'DELETE FROM attendance_holidays')[0][1],('BATCH','2026-12-25'))
        self.assertEqual(calls(cursor,'audit_events')[0][1],
                         ('BATCH','coordinator',8,0,'holiday-2026-12-25','Removed holiday: Christmas Day','Success'))

    def test_unknown_holiday_other_batch_and_bad_date_are_refused(self):
        for options,status in ((dict(found=False),404),(dict(owned=False),404),(dict(day='not-a-date'),400)):
            with self.subTest(options),self.assertRaises(HTTPException) as caught:
                self.remove(**options)
            self.assertEqual(caught.exception.status_code,status)
