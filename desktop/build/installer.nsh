; Nexo Messenger Installer - Custom actions

!macro customInit
  StrCpy $INSTDIR "$PROGRAMFILES64\Nexo Messenger"
!macroend

!macro customInstall
  ; Create desktop shortcut
  CreateShortCut "$DESKTOP\Nexo Messenger.lnk" "$INSTDIR\Nexo Messenger.exe" ""
  
  ; Create start menu shortcut  
  CreateShortCut "$SMPROGRAMS\Nexo Messenger.lnk" "$INSTDIR\Nexo Messenger.exe" ""
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Nexo Messenger.lnk"
  Delete "$SMPROGRAMS\Nexo Messenger.lnk"
!macroend
