; Nexo Messenger Installer Script

!macro customInit
  StrCpy $INSTDIR "$PROGRAMFILES64\Nexo Messenger"
!macroend

!macro customInstall
  CreateShortCut "$DESKTOP\Nexo Messenger.lnk" "$INSTDIR\Nexo Messenger.exe" ""
  CreateShortCut "$SMPROGRAMS\Nexo Messenger.lnk" "$INSTDIR\Nexo Messenger.exe" ""
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Nexo Messenger.lnk"
  Delete "$SMPROGRAMS\Nexo Messenger.lnk"
!macroend
