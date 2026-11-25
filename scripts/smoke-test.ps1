param([string]$Base = "http://localhost:5090")

$script:pass = 0
$script:fail = 0

function Check([string]$name, $ok) {
  if ($ok) { Write-Host "PASS  $name" -ForegroundColor Green; $script:pass++ }
  else     { Write-Host "FAIL  $name" -ForegroundColor Red;   $script:fail++ }
}

function Invoke-Api([string]$method, [string]$path, $token, $body) {
  $params = @{ Method = $method; Uri = "$Base$path"; UseBasicParsing = $true }
  if ($token) { $params["Headers"] = @{ Authorization = "Bearer $token" } }
  if ($null -ne $body) {
    $params["ContentType"] = "application/json"
    $params["Body"] = ($body | ConvertTo-Json -Depth 5)
  }
  try {
    $r = Invoke-WebRequest @params -TimeoutSec 60
    $data = $null
    if ($r.Content) { $data = $r.Content | ConvertFrom-Json }
    return [pscustomobject]@{ Status = [int]$r.StatusCode; Data = $data }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    return [pscustomobject]@{ Status = $code; Data = $null }
  }
}

function ToList($d) { if ($null -eq $d) { return ,@() } else { return ,@($d) } }

function Get-Auth([string]$email, [string]$name) {
  $pw = "Passw0rd!123"
  $r = Invoke-Api POST "/api/auth/register" $null @{ email = $email; displayName = $name; password = $pw }
  if ($r.Status -ne 200) { $r = Invoke-Api POST "/api/auth/login" $null @{ email = $email; password = $pw } }
  return $r
}

Write-Host "`n== Preflight =="
$ping = Invoke-Api GET "/api/auth/me" $null $null
if ($ping.Status -ne 401) { Write-Host "API not reachable at $Base (status $($ping.Status)). Start it with: dotnet run" -ForegroundColor Yellow; exit 1 }
Write-Host "API is up."

Write-Host "`n== Users =="
$aliceAuth = Get-Auth "test@example.com" "Test User"
$bobAuth   = Get-Auth "bob@example.com" "Bob"
$carolAuth = Get-Auth "carol@example.com" "Carol"
$alice = $aliceAuth.Data.token; $bob = $bobAuth.Data.token; $carol = $carolAuth.Data.token
Check "three users can authenticate" ($alice -and $bob -and $carol)
if (-not ($alice -and $bob -and $carol)) { exit 1 }

Write-Host "`n== Boards and roles =="
$create = Invoke-Api POST "/api/boards" $alice @{ name = "Smoke test board"; description = "created by smoke-test.ps1" }
Check "create board (201)" ($create.Status -eq 201)
if ($create.Status -ne 201) { exit 1 }
$b = "/api/boards/$($create.Data.id)"
$mine = ToList (Invoke-Api GET "/api/boards" $alice $null).Data
Check "board list contains the board" (@($mine | Where-Object { $_.id -eq $create.Data.id }).Count -eq 1)
Check "non-member gets 404" ((Invoke-Api GET $b $bob $null).Status -eq 404)
Check "owner adds Bob as Admin" ((Invoke-Api POST "$b/members" $alice @{ email = "bob@example.com"; role = "Admin" }).Status -eq 200)
Check "owner adds Carol as Viewer" ((Invoke-Api POST "$b/members" $alice @{ email = "carol@example.com"; role = "Viewer" }).Status -eq 200)
Check "Admin cannot delete board (403)" ((Invoke-Api DELETE $b $bob $null).Status -eq 403)

Write-Host "`n== Columns and cards =="
function Get-Titles([string]$columnId) {
  $all = ToList (Invoke-Api GET "$b/columns" $alice $null).Data
  $col = $all | Where-Object { $_.id -eq $columnId }
  return (@($col.cards | ForEach-Object { $_.title }) -join ",")
}

$cols = ToList (Invoke-Api GET "$b/columns" $alice $null).Data
Check "3 default columns" ($cols.Count -eq 3 -and (($cols | ForEach-Object { $_.name }) -join ",") -eq "To Do,In Progress,Done")
$todo = $cols[0].id; $doing = $cols[1].id; $done = $cols[2].id

$c1 = (Invoke-Api POST "$b/columns/$todo/cards" $alice @{ title = "Card 1" }).Data
$c2 = (Invoke-Api POST "$b/columns/$todo/cards" $bob @{ title = "Card 2" }).Data
$c3 = (Invoke-Api POST "$b/columns/$todo/cards" $alice @{ title = "Card 3" }).Data
Check "three cards created" ($c1.id -and $c2.id -and $c3.id)
Check "Viewer cannot create cards (403)" ((Invoke-Api POST "$b/columns/$todo/cards" $carol @{ title = "Nope" }).Status -eq 403)
Check "Viewer can read columns (200)" ((Invoke-Api GET "$b/columns" $carol $null).Status -eq 200)
Check "creation order is kept" ((Get-Titles $todo) -eq "Card 1,Card 2,Card 3")

Check "move Card 3 to the top" ((Invoke-Api POST "$b/cards/$($c3.id)/move" $alice @{ columnId = $todo; index = 0 }).Status -eq 204)
Check "order: Card 3, Card 1, Card 2" ((Get-Titles $todo) -eq "Card 3,Card 1,Card 2")
Check "move Card 1 to In Progress" ((Invoke-Api POST "$b/cards/$($c1.id)/move" $alice @{ columnId = $doing; index = 0 }).Status -eq 204)
Check "In Progress holds Card 1; To Do holds Card 3, Card 2" ((Get-Titles $doing) -eq "Card 1" -and (Get-Titles $todo) -eq "Card 3,Card 2")
Check "move Card 1 back between the others" ((Invoke-Api POST "$b/cards/$($c1.id)/move" $alice @{ columnId = $todo; index = 1 }).Status -eq 204)
Check "order: Card 3, Card 1, Card 2" ((Get-Titles $todo) -eq "Card 3,Card 1,Card 2")

Check "update card with assignee" ((Invoke-Api PUT "$b/cards/$($c2.id)" $alice @{ title = "Card 2 (edited)"; description = "edited"; assigneeId = $bobAuth.Data.user.id }).Status -eq 204)
Check "non-member assignee rejected (400)" ((Invoke-Api PUT "$b/cards/$($c2.id)" $alice @{ title = "x"; assigneeId = ([guid]::NewGuid().ToString()) }).Status -eq 400)
Check "delete card" ((Invoke-Api DELETE "$b/cards/$($c2.id)" $alice $null).Status -eq 204)

$newCol = Invoke-Api POST "$b/columns" $bob @{ name = "Review" }
Check "Admin creates a column" ($newCol.Status -eq 200)
Check "move Done to the front" ((Invoke-Api POST "$b/columns/$done/move" $alice @{ index = 0 }).Status -eq 204)
$after = ToList (Invoke-Api GET "$b/columns" $alice $null).Data
Check "column order: Done, To Do, In Progress, Review" ((($after | ForEach-Object { $_.name }) -join ",") -eq "Done,To Do,In Progress,Review")
Check "rename and delete column" ((Invoke-Api PUT "$b/columns/$($newCol.Data.id)" $alice @{ name = "QA" }).Status -eq 204 -and (Invoke-Api DELETE "$b/columns/$($newCol.Data.id)" $alice $null).Status -eq 204)

Write-Host "`n== Cleanup =="
Check "owner deletes the test board" ((Invoke-Api DELETE $b $alice $null).Status -eq 204)

$color = "Green"
if ($script:fail -gt 0) { $color = "Red" }
Write-Host "`nResult: $($script:pass) passed, $($script:fail) failed" -ForegroundColor $color
