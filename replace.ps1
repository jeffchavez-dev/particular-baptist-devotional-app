$content = Get-Content -Path "c:\Users\Jeff Chavez\Claude\devotional-app\src\data\lbcf1.js" -Raw
$content = $content -replace '(?s)text: \'(.*?)\', refs:', {
    param($match)
    $text = $match.Groups[1].Value -replace '\n', ' '
    "text: '$text', refs:"
}
Set-Content -Path "c:\Users\Jeff Chavez\Claude\devotional-app\src\data\lbcf1.js" -Value $content