' ============================================================
' Nexo Messenger - Linux VBS Application (via Mono + VBS)
' ============================================================

Option Explicit

Dim WshShell, FSO, ServerURL
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

ServerURL = "http://localhost:3001"

MsgBox "Nexo Messenger для Linux" & vbCrLf & vbCrLf & _
       "Для запуска используйте:" & vbCrLf & _
       "1. Web-версию: " & ServerURL & vbCrLf & _
       "2. Или Electron-приложение из папки linux/app/" & vbCrLf & vbCrLf & _
       "Сервер: " & ServerURL, _
       vbInformation, "Nexo Messenger - Linux"

Set WshShell = Nothing
Set FSO = Nothing
