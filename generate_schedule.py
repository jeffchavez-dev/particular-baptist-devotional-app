#!/usr/bin/env python3

import csv
from datetime import datetime, timedelta

# Schedule generation logic
mShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
mDays  = [31,28,31,30,31,30,31,31,30,31,30,31]

def dateStr(n):
    d = n - 1
    m = 0
    while d >= mDays[m]:
        d -= mDays[m]
        m += 1
    return f"{mShort[m]} {d + 1}"

# 2LBCF Chapters
chapters = [
    {'ch': 1, 't': 'Of the Holy Scriptures', 'p': 10},
    {'ch': 2, 't': 'Of God and of the Holy Trinity', 'p': 3},
    {'ch': 3, 't': "Of God's Decree", 'p': 7},
    {'ch': 4, 't': 'Of Creation', 'p': 4},
    {'ch': 5, 't': 'Of Divine Providence', 'p': 7},
    {'ch': 6, 't': 'Of the Fall of Man', 'p': 6},
    {'ch': 7, 't': "Of God's Covenant", 'p': 3},
    {'ch': 8, 't': 'Of Christ the Mediator', 'p': 10},
    {'ch': 9, 't': 'Of Free Will', 'p': 5},
    {'ch': 10, 't': 'Of Effectual Calling', 'p': 4},
    {'ch': 11, 't': 'Of Justification', 'p': 5},
    {'ch': 12, 't': 'Of Adoption', 'p': 1},
    {'ch': 13, 't': 'Of Sanctification', 'p': 3},
    {'ch': 14, 't': 'Of Saving Faith', 'p': 3},
    {'ch': 15, 't': 'Of Repentance unto Life', 'p': 6},
    {'ch': 16, 't': 'Of Good Works', 'p': 7},
    {'ch': 17, 't': 'Of Perseverance of the Saints', 'p': 3},
    {'ch': 18, 't': 'Of Assurance of Grace', 'p': 4},
    {'ch': 19, 't': 'Of the Law of God', 'p': 7},
    {'ch': 20, 't': 'Of the Gospel', 'p': 4},
    {'ch': 21, 't': 'Of Christian Liberty', 'p': 3},
    {'ch': 22, 't': 'Of Religious Worship & Sabbath', 'p': 8},
    {'ch': 23, 't': 'Of Lawful Oaths and Vows', 'p': 5},
    {'ch': 24, 't': 'Of the Civil Magistrate', 'p': 4},
    {'ch': 25, 't': 'Of Marriage', 'p': 3},
    {'ch': 26, 't': 'Of the Church', 'p': 15},
    {'ch': 27, 't': 'Of Communion of Saints', 'p': 2},
    {'ch': 28, 't': "Of Baptism and the Lord's Supper", 'p': 4},
    {'ch': 29, 't': 'Of Baptism', 'p': 4},
    {'ch': 30, 't': "Of the Lord's Supper", 'p': 8},
    {'ch': 31, 't': 'Of the State after Death', 'p': 3},
    {'ch': 32, 't': 'Of the Last Judgment', 'p': 2},
]

lbcf2 = []
for c in chapters:
    for p in range(1, c['p'] + 1):
        lbcf2.append({
            'src': '2LBCF',
            'reading': f"Ch. {c['ch']} §{p}",
            'detail': c['t']
        })

# Catechism
catechism = []
for i in range(1, 115):
    catechism.append({
        'src': 'Catechism',
        'reading': f"Q&A #{i}",
        'detail': "The Baptist Catechism (Keach's)"
    })

# 1LBCF
lbcf1_titles = [
    'The Holy Scriptures', 'Of God', 'Of the Decrees of God', 'Of Creation', 'Of Providence',
    'Of the Fall and Original Sin', "Of the Covenant of God", 'Of Christ the Mediator',
    'Of Free Will', 'Of Effectual Calling', 'Of Justification', 'Of Adoption', 'Of Sanctification',
    'Of Saving Faith', 'Of Repentance and Salvation', 'Of Good Works', 'Of Perseverance of Saints',
    'Of the Assurance of Salvation', 'Of the Law of God', 'Of the Gospel', 'Of Christian Liberty',
    'Of Worship and the Sabbath', 'Of Oaths and Vows', 'Of the Civil Magistrate', 'Of Marriage',
    'Of the Church', 'Of Communion of Saints', "Of Baptism and the Lord's Supper", 'Of Baptism',
    "Of the Lord's Supper", 'Of the State after Death', 'Of the Last Judgment',
    "Of Scripture's Perfection", 'Of the Rule of Faith', 'Of Judgment of Controversies',
    'Of Private Judgment', 'Of Creeds and Confessions', "Of the Church's Authority",
    'Of Church Councils', 'Of the Visible Church', 'Of Officers of the Church',
    'Of Church Censures', 'Of the Power of the Keys', 'Of Calling to Office', 'Of the Sacraments',
    'Of the Word and Sacraments', 'Of Infant Membership', 'Of Covenant Children',
    'Of Church Discipline', 'Of Communion of Churches', 'Of Civil Government and Religion',
    'Of the Final State',
]

lbcf1 = []
for i, t in enumerate(lbcf1_titles, 1):
    lbcf1.append({
        'src': '1LBCF',
        'reading': f"Article {i}",
        'detail': t
    })

# Review prompts
review_prompts = [
    'Revisit your favourite reading from this week',
    'Meditate on a Scripture tied to this week\'s doctrine',
    'Write a short reflection — what stood out most?',
    'Discuss this week\'s readings with a friend or family',
    'Pray through a doctrine you studied this week',
    'Read a related passage from the Psalms',
    'Journal your thoughts on this week\'s theme',
]

def build_schedule():
    pool = []
    i2 = 0
    iC = 0
    i1 = 0
    iR = 0
    
    for day in range(1, 366):
        if day % 7 == 0:
            pool.append({
                'day': day,
                'date': dateStr(day),
                'src': 'Review',
                'reading': 'Weekly review & reflection',
                'detail': review_prompts[iR % len(review_prompts)]
            })
            iR += 1
        else:
            turn = (day - (day // 7)) % 3
            pushed = False
            
            def try_push(arr, idx):
                if idx < len(arr):
                    entry = {
                        'day': day,
                        'date': dateStr(day),
                        **arr[idx]
                    }
                    pool.append(entry)
                    return True
                return False
            
            if turn == 0 and try_push(lbcf2, i2):
                i2 += 1
                pushed = True
            elif turn == 1 and try_push(catechism, iC):
                iC += 1
                pushed = True
            elif turn == 2 and try_push(lbcf1, i1):
                i1 += 1
                pushed = True
            
            if not pushed:
                if try_push(lbcf2, i2):
                    i2 += 1
                elif try_push(catechism, iC):
                    iC += 1
                elif try_push(lbcf1, i1):
                    i1 += 1
    
    return pool

schedule = build_schedule()

# Write CSV
with open('schedule.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['Day', 'Date', 'Source', 'Reading', 'Detail'])
    writer.writeheader()
    for entry in schedule:
        writer.writerow({
            'Day': entry['day'],
            'Date': entry['date'],
            'Source': entry['src'],
            'Reading': entry['reading'],
            'Detail': entry['detail']
        })

# Write Text file
with open('schedule.txt', 'w', encoding='utf-8') as f:
    f.write('Particular Baptist Devotional - 365-Day Schedule\n')
    f.write('=' * 100 + '\n\n')
    for entry in schedule:
        f.write(f"Day {str(entry['day']).rjust(3)} | {entry['date'].ljust(10)} | {entry['src'].ljust(10)} | {entry['reading'].ljust(20)} | {entry['detail']}\n")

print('✓ schedule.csv generated (365 days)')
print('✓ schedule.txt generated (365 days)')
