#!/bin/sh
# Opens one workbook in LibreOffice Calc, headless, with its defaults, and writes what Calc made of it (task 46.2):
#
#   calc-gate /data/<file>.xlsx
#
#   /data/out/<file>-<Sheet>.csv    every sheet's values as Calc shows them once the file is open — its formulas'
#                                   results among them, computed on load (§12.5.6's task-46 row (4))
#   /data/out/round-trip/<file>.xlsx the workbook as Calc saves it again — its defined names, data validations,
#                                   formulas and notes, which the suite compares with the template's own round trip
#
# **A file Calc cannot open is a failure, not an empty answer**: soffice reports a load error on stderr and exits 0, so
# the outputs' presence is what is checked.
set -eu

# **What it writes, the host's user can remove.** The container runs as root and /data is the suite's own temporary
# directory, so root-owned `out/` would outlive the suite's cleanup with EACCES on a Linux host — Docker Desktop's file
# sharing hides ownership, so only CI's runner ever saw it.
umask 000

in="$1"
name=$(basename "$in" .xlsx)
out=/data/out
mkdir -p "$out/round-trip"

soffice --headless --norestore --nologo \
  --convert-to 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,-1' \
  --outdir "$out" "$in"
soffice --headless --norestore --nologo --convert-to xlsx --outdir "$out/round-trip" "$in"

if [ ! -f "$out/round-trip/$name.xlsx" ] || ! ls "$out/$name"-*.csv > /dev/null 2>&1; then
  echo "LibreOffice Calc could not open $in" >&2
  exit 2
fi
