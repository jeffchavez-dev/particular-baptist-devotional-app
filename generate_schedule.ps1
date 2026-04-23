# Generate Full 365-Day Devotional Schedule
$mShort = @('Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec')
$mDays = @(31,28,31,30,31,30,31,31,30,31,30,31)

function dateStr($n) {
    $d = $n - 1
    $m = 0
    while ($d -ge $mDays[$m]) {
        $d -= $mDays[$m]
        $m++
    }
    return "$($mShort[$m]) $($d + 1)"
}

# 2LBCF data
$lbcf2 = @(
    @{ch=1;t='Of the Holy Scriptures';p=10},
    @{ch=2;t='Of God and of the Holy Trinity';p=3},
    @{ch=3;t="Of God's Decree";p=7},
    @{ch=4;t='Of Creation';p=4},
    @{ch=5;t='Of Divine Providence';p=7},
    @{ch=6;t='Of the Fall of Man';p=6},
    @{ch=7;t="Of God's Covenant";p=3},
    @{ch=8;t='Of Christ the Mediator';p=10},
    @{ch=9;t='Of Free Will';p=5},
    @{ch=10;t='Of Effectual Calling';p=4},
    @{ch=11;t='Of Justification';p=5},
    @{ch=12;t='Of Adoption';p=1},
    @{ch=13;t='Of Sanctification';p=3},
    @{ch=14;t='Of Saving Faith';p=3},
    @{ch=15;t='Of Repentance unto Life';p=6},
    @{ch=16;t='Of Good Works';p=7},
    @{ch=17;t='Of Perseverance of the Saints';p=3},
    @{ch=18;t='Of Assurance of Grace';p=4},
    @{ch=19;t='Of the Law of God';p=7},
    @{ch=20;t='Of the Gospel';p=4},
    @{ch=21;t='Of Christian Liberty';p=3},
    @{ch=22;t='Of Religious Worship & Sabbath';p=8},
    @{ch=23;t='Of Lawful Oaths and Vows';p=5},
    @{ch=24;t='Of the Civil Magistrate';p=4},
    @{ch=25;t='Of Marriage';p=3},
    @{ch=26;t='Of the Church';p=15},
    @{ch=27;t='Of Communion of Saints';p=2},
    @{ch=28;t="Of Baptism and the Lord's Supper";p=4},
    @{ch=29;t='Of Baptism';p=4},
    @{ch=30;t="Of the Lord's Supper";p=8},
    @{ch=31;t='Of the State after Death';p=3},
    @{ch=32;t='Of the Last Judgment';p=2}
)

$lbcf2_readings = @()
foreach ($c in $lbcf2) {
    for ($p = 1; $p -le $c.p; $p++) {
        $lbcf2_readings += @{src='2LBCF'; reading="Ch. $($c.ch) §$p"; detail=$c.t}
    }
}

# Catechism data (114 Q&As)
$catechism_readings = @()
for ($i = 1; $i -le 114; $i++) {
    $catechism_readings += @{src='Catechism'; reading="Q&A #$i"; detail="The Baptist Catechism (Keach's)"}
}

# 1LBCF data
$lbcf1_titles = @(
    'The Holy Scriptures','Of God','Of the Decrees of God','Of Creation','Of Providence',
    'Of the Fall and Original Sin',"Of the Covenant of God",'Of Christ the Mediator',
    'Of Free Will','Of Effectual Calling','Of Justification','Of Adoption','Of Sanctification',
    'Of Saving Faith','Of Repentance and Salvation','Of Good Works','Of Perseverance of Saints',
    'Of the Assurance of Salvation','Of the Law of God','Of the Gospel','Of Christian Liberty',
    'Of Worship and the Sabbath','Of Oaths and Vows','Of the Civil Magistrate','Of Marriage',
    'Of the Church','Of Communion of Saints',"Of Baptism and the Lord's Supper",'Of Baptism',
    "Of the Lord's Supper",'Of the State after Death','Of the Last Judgment',
    "Of Scripture's Perfection",'Of the Rule of Faith','Of Judgment of Controversies',
    'Of Private Judgment','Of Creeds and Confessions',"Of the Church's Authority",
    'Of Church Councils','Of the Visible Church','Of Officers of the Church',
    'Of Church Censures','Of the Power of the Keys','Of Calling to Office','Of the Sacraments',
    'Of the Word and Sacraments','Of Infant Membership','Of Covenant Children',
    'Of Church Discipline','Of Communion of Churches','Of Civil Government and Religion',
    'Of the Final State'
)

$lbcf1_readings = @()
for ($i = 0; $i -lt $lbcf1_titles.Count; $i++) {
    $lbcf1_readings += @{src='1LBCF'; reading="Article $($i+1)"; detail=$lbcf1_titles[$i]}
}

# Review prompts
$review_prompts = @(
    'Revisit your favourite reading from this week',
    'Meditate on a Scripture tied to this week''s doctrine',
    'Write a short reflection — what stood out most?',
    'Discuss this week''s readings with a friend or family',
    'Pray through a doctrine you studied this week',
    'Read a related passage from the Psalms',
    'Journal your thoughts on this week''s theme'
)

# Build schedule
$schedule = @()
$i2 = 0
$iC = 0
$i1 = 0
$iR = 0

for ($day = 1; $day -le 365; $day++) {
    if ($day % 7 -eq 0) {
        $schedule += @{
            day = $day
            date = dateStr $day
            src = 'Review'
            reading = 'Weekly review & reflection'
            detail = $review_prompts[$iR % $review_prompts.Count]
        }
        $iR++
    } else {
        $turn = ($day - [Math]::Floor($day / 7)) % 3
        $pushed = $false
        
        if ($turn -eq 0 -and $i2 -lt $lbcf2_readings.Count) {
            $schedule += @{
                day = $day
                date = dateStr $day
                $($lbcf2_readings[$i2].Keys) = $($lbcf2_readings[$i2].Values)
            } + $lbcf2_readings[$i2]
            $i2++
            $pushed = $true
        } elseif ($turn -eq 1 -and $iC -lt $catechism_readings.Count) {
            $schedule += @{
                day = $day
                date = dateStr $day
            } + $catechism_readings[$iC]
            $iC++
            $pushed = $true
        } elseif ($turn -eq 2 -and $i1 -lt $lbcf1_readings.Count) {
            $schedule += @{
                day = $day
                date = dateStr $day
            } + $lbcf1_readings[$i1]
            $i1++
            $pushed = $true
        }
        
        if (-not $pushed) {
            if ($i2 -lt $lbcf2_readings.Count) {
                $schedule += @{day = $day; date = dateStr $day} + $lbcf2_readings[$i2]
                $i2++
            } elseif ($iC -lt $catechism_readings.Count) {
                $schedule += @{day = $day; date = dateStr $day} + $catechism_readings[$iC]
                $iC++
            } elseif ($i1 -lt $lbcf1_readings.Count) {
                $schedule += @{day = $day; date = dateStr $day} + $lbcf1_readings[$i1]
                $i1++
            }
        }
    }
}

# Export to CSV
$schedule | Select-Object day, date, src, reading, detail | Export-Csv -Path 'schedule.csv' -NoTypeInformation
Write-Host "[OK] schedule.csv created with $($schedule.Count) days"

# Export to text file with formatting
$csv_content = "Day,Date,Source,Reading,Detail" + "`n"
foreach ($entry in $schedule) {
    $csv_content += "$($entry.day),$($entry.date),$($entry.src),$($entry.reading),$($entry.detail)" + "`n"
}
Set-Content -Path 'schedule_formatted.csv' -Value $csv_content
Write-Host "[OK] schedule_formatted.csv created with $($schedule.Count) days"

# Export to text file
$txt_content = "Particular Baptist Devotional - 365-Day Schedule" + "`n"
$txt_content += ("=" * 100) + "`n`n"
foreach ($entry in $schedule) {
    $day_str = $entry.day.ToString().PadLeft(3)
    $date_str = $entry.date.PadRight(10)
    $src_str = $entry.src.PadRight(10)
    $reading_str = $entry.reading.PadRight(20)
    $txt_content += "Day $day_str | $date_str | $src_str | $reading_str | $($entry.detail)" + "`n"
}
Set-Content -Path 'schedule.txt' -Value $txt_content
Write-Host "[OK] schedule.txt created with $($schedule.Count) days"

Write-Host "Files created in: $((Get-Location).Path)"
