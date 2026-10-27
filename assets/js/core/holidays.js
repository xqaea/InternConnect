/* ============ Holidays and no-work days (per batch) ============ */

// Prototype storage: ic_holidays {classCode: [{date, name, type}]}. Holidays are not counted as absences.
const HOLIDAY_KEY = 'ic_holidays';
const PH_HOLIDAYS_2026 = [
    ['2026-01-01', "New Year's Day", 'Regular holiday'], ['2026-02-17', 'Chinese New Year', 'Special non-working day'],
    ['2026-04-02', 'Maundy Thursday', 'Regular holiday'], ['2026-04-03', 'Good Friday', 'Regular holiday'],
    ['2026-04-04', 'Black Saturday', 'Special non-working day'], ['2026-04-09', 'Araw ng Kagitingan', 'Regular holiday'],
    ['2026-05-01', 'Labor Day', 'Regular holiday'], ['2026-06-12', 'Independence Day', 'Regular holiday'],
    ['2026-08-21', 'Ninoy Aquino Day', 'Special non-working day'], ['2026-08-31', 'National Heroes Day', 'Regular holiday'],
    ['2026-11-01', "All Saints' Day", 'Special non-working day'], ['2026-11-30', 'Bonifacio Day', 'Regular holiday'],
    ['2026-12-08', 'Feast of the Immaculate Conception', 'Special non-working day'], ['2026-12-24', 'Christmas Eve', 'Special non-working day'],
    ['2026-12-25', 'Christmas Day', 'Regular holiday'], ['2026-12-30', 'Rizal Day', 'Regular holiday'], ['2026-12-31', 'Last Day of the Year', 'Special non-working day']
];
function getHolidays(){
    const all = getJSON(HOLIDAY_KEY, {}), code = activeClassCode() || 'default';
    if(!all[code]){
        all[code] = PH_HOLIDAYS_2026.filter(h => ['2026-06-12', '2026-08-21', '2026-08-31'].includes(h[0])).map(([date, name, type]) => ({date, name, type}));
        localStorage.setItem(HOLIDAY_KEY, JSON.stringify(all));
    }
    return all[code].slice().sort((a, b) => a.date.localeCompare(b.date));
}
function saveHolidays(list){
    const all = getJSON(HOLIDAY_KEY, {});
    all[activeClassCode() || 'default'] = list;
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(all));
}
