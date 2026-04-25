$content = Get-Content 'src/data/lbcf2.js' -Raw

# Stage 1: Fix markers before common short words that are legitimate words
$patterns = @(
    # Pattern: marker before common 2-4 letter words
    @{pattern = 'ato\b'; replacement = 'to' },
    @{pattern = 'bof\b'; replacement = 'of' },
    @{pattern = 'bor\b'; replacement = 'or' },
    @{pattern = 'cpriest'; replacement = 'priest' },
    @{pattern = 'dking'; replacement = 'king' },
    @{pattern = 'dwriting'; replacement = 'writing' },
    @{pattern = 'einspiration'; replacement = 'inspiration' },
    @{pattern = 'fdivine'; replacement = 'divine' },
    @{pattern = 'under'; replacement = 'under' },
    @{pattern = 'fmade'; replacement = 'made' },
    @{pattern = 'gwritten'; replacement = 'written' },
    @{pattern = 'hsubject'; replacement = 'subject' },
    @{pattern = 'iacommand'; replacement = 'a command' },
    @{pattern = 'kover'; replacement = 'over' },
    @{pattern = 'auphold'; replacement = 'uphold' },
    @{pattern = 'bleast'; replacement = 'least' },
    @{pattern = 'cown'; replacement = 'own' },
    @{pattern = 'dimmutably'; replacement = 'immutably' },
    @{pattern = 'eby'; replacement = 'by' },
    @{pattern = 'gmaketh'; replacement = 'maketh' },
    @{pattern = 'hto'; replacement = 'to' },
    @{pattern = 'iabove'; replacement = 'above' },
    @{pattern = 'kagainst'; replacement = 'against' },
    @{pattern = 'lextendeth'; replacement = 'extendeth' },
    @{pattern = 'mboundeth'; replacement = 'boundeth' },
    @{pattern = 'nends'; replacement = 'ends' },
    @{pattern = 'oapprover'; replacement = 'approver' },
    @{pattern = 'pthat'; replacement = 'that' },
    @{pattern = 'rblind'; replacement = 'blind' },
    @{pattern = 'sgrace'; replacement = 'grace' },
    @{pattern = 'tthe'; replacement = 'the' },
    @{pattern = 'uobjects'; replacement = 'objects' },
    @{pattern = 'xgives'; replacement = 'gives' },
    @{pattern = 'yharden'; replacement = 'harden' },
    @{pattern = 'zchurch'; replacement = 'church' },
    # More markers before 'h'
    @{pattern = 'hfull'; replacement = 'full' },
    @{pattern = 'hprotected'; replacement = 'protected' },
    @{pattern = 'hprovided'; replacement = 'provided' },
    @{pattern = 'hcast'; replacement = 'cast' },
    @{pattern = 'hof'; replacement = 'of' },
    @{pattern = 'hto'; replacement = 'to' },
    @{pattern = 'humble'; replacement = 'humble' },
    @{pattern = 'hurt'; replacement = 'hurt' },
    @{pattern = 'humble\s'; replacement = 'humble ' }
)

# Apply replacements
$fixed = $content
$count = 0

foreach ($p in $patterns) {
    if ($fixed -match $p.pattern) {
        $fixed = $fixed -replace $p.pattern, $p.replacement
        $count++
    }
}

Write-Host "Applied $count replacement patterns"

# Stage 2: Handle markers that appear after word endings before space
# Pattern: e + marker + space or punctuation (like "theb " -> "the ")
# This is safer because it only targets single letters after 'e' followed by space/punct
$fixed = $fixed -replace '([a-z])[a-z](?=[\s,.:;!?\''"])', '$1'

Set-Content 'src/data/lbcf2.js' $fixed
Write-Host "File updated successfully!"
