"""Career suggestions are semantic similarities, never hiring probabilities."""
import re
from matching import cosine_similarity


def key(value):
    return re.sub(r'\s+',' ',value.strip().casefold())


def profile_text(occupation):
    skills=[item['name'] for item in occupation['skills'][:12]]
    knowledge=[item['name'] for item in occupation['knowledge'][:5]]
    tasks=[item['description'] for item in occupation['tasks'][:3]]
    return '. '.join([occupation['title'],occupation['description'],
        'Skills: '+', '.join(skills), 'Knowledge: '+', '.join(knowledge),
        'Software: '+', '.join(occupation['software'][:12]),*tasks])


def rank_careers(student_vector,occupations,vectors,student_skills,limit):
    listed={key(skill) for skill in student_skills}
    ranked=[]
    for occupation,vector in zip(occupations,vectors):
        similarity=cosine_similarity(student_vector,vector)
        requirements=list(dict.fromkeys([item['name'] for item in occupation['skills'][:12]]+occupation['software'][:12]))
        matched=[skill for skill in requirements if key(skill) in listed]
        gaps=[skill for skill in requirements if key(skill) not in listed]
        reasons=['Your saved resume was compared with this career’s description, skills and work activities.']
        reasons.append('Your resume lists: '+', '.join(matched[:5])+'.' if matched else
            'No direct listed-skill overlaps were found; this suggestion comes from semantic similarity.')
        ranked.append(dict(code=occupation['code'],title=occupation['title'],description=occupation['description'],
            similarity=round(similarity,6),alignment_percent=round(max(0,min(1,similarity))*100,1),
            matched_skills=matched[:6],skills_to_explore=gaps[:6],reasons=reasons))
    return sorted(ranked,key=lambda item:(-item['similarity'],item['code']))[:limit]
