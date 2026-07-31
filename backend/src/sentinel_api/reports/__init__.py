"""PDF report rendering — presentation only, no domain logic.

Lives in sentinel_api (not sentinel_core): CLAUDE.md hard rule 1 says
core stays HTTP-/UI-free, and a PDF layout is UI, just for paper instead
of a browser. Callers (routers/reports.py) fetch all data via existing
sentinel_core functions first; this package only lays it out.
"""
