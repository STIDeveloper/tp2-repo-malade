#!/usr/bin/env bash
# usage: capture-terminal.sh <cwd> <out.png> <lignes> <titre>   (commandes sur stdin, une par ligne)
# Chaque ligne est affichee "$ commande" juste avant d'etre executee.
# Ouvre une vraie fenetre console Windows (conhost), y execute les commandes, puis la
# capture avec PrintWindow : c'est ainsi qu'ont ete produites les images de captures/.
S="$(cd "$(dirname "$0")" && pwd)"
f="$(mktemp)"
while IFS= read -r line || [ -n "$line" ]; do
  if [ -z "${line// }" ]; then echo "echo"; continue; fi
  q=${line//\'/\'\\\'\'}
  printf "printf '%%s\\\\n' '\$ %s'\n%s\n" "$q" "$line"
done > "$f"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$S/capture-terminal.ps1")" -Cwd "$(cygpath -w "$1")" -Out "$(cygpath -w "$2")" -Rows "$3" -Title "$4" -CmdFile "$(cygpath -w "$f")" -Cols "${COLS:-120}"
rm -f "$f"
