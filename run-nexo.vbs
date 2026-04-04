' Nexo Messenger - VBScript Launcher for Windows
' Этот скрипт запускает сервер Nexo и открывает его в браузере

Option Explicit

Dim WshShell, FSO, ScriptPath, ServerPath, ServerURL, Port
Dim objExec, strLine, bStarted, i

' Configuration
ServerURL = "http://localhost:3001"
Port = "3001"

' Create objects
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get script directory
ScriptPath = FSO.GetParentFolderName(WScript.ScriptFullName)
ServerPath = ScriptPath & "\apps\server"

' Check if server path exists
If Not FSO.FolderExists(ServerPath) Then
    MsgBox "Не найдена папка сервера: " & ServerPath & vbCrLf & vbCrLf & _
           "Убедитесь что вы запустили скрипт из корневой папки Nexo", _
           vbCritical, "Nexo Messenger - Ошибка"
    WScript.Quit 1
End If

' Show start message
WshShell.Popup "Запуск Nexo Messenger..." & vbCrLf & "Сервер: " & ServerURL, 2, "Nexo Messenger", vbInformation

' Start server in background
Dim cmd
cmd = "cmd /c cd /d """ & ServerPath & """ && npm run dev"

' Run hidden
WshShell.Run cmd, 0, False

' Wait for server to start
bStarted = False
For i = 1 To 30
    WScript.Sleep 2000
    
    ' Check if port is open
    On Error Resume Next
    Dim objHTTP
    Set objHTTP = CreateObject("WinHttp.WinHttpRequest.5.1")
    objHTTP.Open "GET", ServerURL & "/api/health", False
    objHTTP.Send
    
    If Err.Number = 0 Then
        If objHTTP.Status = 200 Then
            bStarted = True
            Exit For
        End If
    End If
    Err.Clear
    On Error GoTo 0
Next

If bStarted Then
    ' Server started, open in browser
    WshShell.Popup "Сервер запущен!" & vbCrLf & "Открываю браузер...", 2, "Nexo Messenger", vbInformation
    WshShell.Run ServerURL, 1, False
    
    ' Show running message
    WshShell.Popup "Nexo Messenger работает!" & vbCrLf & vbCrLf & _
                   "URL: " & ServerURL & vbCrLf & _
                   "Админ-панель: " & ServerURL & "/admin" & vbCrLf & vbCrLf & _
                   "Чтобы остановить сервер, закройте консольное окно", _
                   5, "Nexo Messenger", vbInformation
Else
    MsgBox "Не удалось запустить сервер за 60 секунд." & vbCrLf & vbCrLf & _
           "Проверьте что:" & vbCrLf & _
           "1. Установлены зависимости (npm install)" & vbCrLf & _
           "2. Настроен файл .env" & vbCrLf & _
           "3. База данных доступна", _
           vbCritical, "Nexo Messenger - Ошибка"
End If

' Cleanup
Set WshShell = Nothing
Set FSO = Nothing
