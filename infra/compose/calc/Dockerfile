# LibreOffice Calc, headless — NFR-20's automated gate for the Excel export (task 46.2; T-12, FR-50 behaviour 5).
#
# Test-only, as veraPDF is: the export suites run it once per file they produce, with `docker compose run --rm calc`
# against the test stack's Compose file, and nothing in the product calls it. Microsoft 365 and desktop Excel are the
# release checklist's manual item (docs/runbooks/release-checklist.md), because server-side Office automation is
# unsupported on Linux.
#
# **It opens a file with LibreOffice's own defaults**, which is the point (architecture.md §12.5.6's task-46 row (4)):
# an export names the platform as the application that wrote it, and LibreOffice recalculates on load any file whose
# writer is not Microsoft Excel — so what this gate reads is what a reader's LibreOffice shows, not what a forced
# recalculation would.
#
# LibreOffice is Debian trixie's, its version fixed with the base image rather than pinned by hand, as the renderer's
# pikepdf is; the build refuses a LibreOffice outside the 25.2 line the gate was measured on (§12.1).
FROM debian:trixie-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends libreoffice-calc-nogui \
 && rm -rf /var/lib/apt/lists/*

RUN soffice --version | tee /dev/stderr | grep -q '^LibreOffice 25\.2\.'

COPY calc-gate.sh /usr/local/bin/calc-gate
RUN chmod 0755 /usr/local/bin/calc-gate

# LibreOffice writes its user profile on first start; a throwaway home keeps it out of the mounted directory.
ENV HOME=/tmp/calc-home
WORKDIR /data
ENTRYPOINT ["calc-gate"]
