' ============================================================
' Nexo Messenger - macOS VBS Application
' ============================================================

Option Explicit

Dim WshShell, ServerURL
Set WshShell = CreateObject("WScript.Shell")

ServerURL = "http://localhost:3001"

MsgBox "Nexo Messenger для macOS" & vbCrLf & vbCrLf & _
       "Для запуска используйте:" & vbCrLf & _
       "1. DMG приложение из папки macos/app/" & vbCrLf & _
       "2. Или Web-версию: " & ServerURL & vbCrLf & vbCrLf & _
       "Сервер: " & ServerURL, _
       vbInformation, "Nexo Messenger - macOS"

Set WshShell = Nothing
