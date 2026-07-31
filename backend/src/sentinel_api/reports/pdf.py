"""Risk-summary PDF layout (reportlab — see pyproject.toml comment for
why reportlab over WeasyPrint). Pure presentation: every value here was
already computed by sentinel_core via sentinel_api/routers/reports.py;
this module only lays it out on paper. No dashes in user-facing text
(project convention, matches the German UI copy elsewhere).
"""

from __future__ import annotations

import io
from datetime import date, datetime
from xml.sax.saxutils import escape as xml_escape

from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import simpleSplit
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from sentinel_api.schemas.risk import AmpelOut, RiskAnalyzeOut
from sentinel_api.schemas.stress import StressReplayOut

# Identical wording to components/Disclaimer.tsx (frontend) — one fixed
# disclaimer, shown wherever the app (web or PDF) states it (Prinzip 3).
# Base-14 PDF fonts (Helvetica) support German umlauts/eszett natively
# via WinAnsiEncoding — no special font embedding needed.
DISCLAIMER_TEXT = (
    "Sentinel beschreibt Portfolioeigenschaften (z. B. Klumpenrisiko, "
    "Volatilität) auf Basis vergangener Kurse. Das ist keine "
    "Anlageberatung und keine Empfehlung für einzelne Wertpapiere. "
    "Kurse sind bis zu 15 Minuten verzögert."
)

_STATUS_COLORS = {
    "green": colors.HexColor("#059669"),
    "yellow": colors.HexColor("#d97706"),
    "red": colors.HexColor("#dc2626"),
}
_STATUS_LABELS = {"green": "Grün", "yellow": "Gelb", "red": "Rot"}

_PAGE_WIDTH, _PAGE_HEIGHT = A4
_MARGIN = 2 * cm

_styles = getSampleStyleSheet()
_TITLE = ParagraphStyle(
    "ReportTitle", parent=_styles["Heading1"], fontSize=18, spaceAfter=2
)
_META = ParagraphStyle(
    "ReportMeta",
    parent=_styles["BodyText"],
    fontSize=8.5,
    textColor=colors.HexColor("#64748b"),
)
_H2 = ParagraphStyle(
    "H2", parent=_styles["Heading2"], fontSize=13, spaceBefore=16, spaceAfter=6
)
_BODY = ParagraphStyle("Body", parent=_styles["BodyText"], fontSize=9.5, leading=13)
_SMALL = ParagraphStyle(
    "Small",
    parent=_styles["BodyText"],
    fontSize=8,
    leading=11,
    textColor=colors.HexColor("#475569"),
)
_DISCLAIMER_STYLE = ParagraphStyle(
    "Disclaimer",
    parent=_styles["BodyText"],
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor("#334155"),
)
_AMPEL_TITLE_BASE = ParagraphStyle(
    "AmpelTitleBase", parent=_BODY, fontSize=11, spaceBefore=8, spaceAfter=2
)


def build_risk_summary_pdf(
    *,
    weights: dict[str, float],
    analysis: RiskAnalyzeOut,
    ampeln: list[AmpelOut],
    stress: StressReplayOut | None,
    generated_at: datetime,
) -> bytes:
    """Renders the full risk-summary PDF and returns the raw bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=_MARGIN,
        rightMargin=_MARGIN,
        topMargin=1.8 * cm,
        bottomMargin=2.4 * cm,
        title="Sentinel Risiko-Report",
    )

    story: list = [
        Paragraph("Sentinel: Risiko-Report", _TITLE),
        Paragraph(f"Erstellt am {generated_at.strftime('%d.%m.%Y, %H:%M')} Uhr", _META),
        Spacer(1, 8),
        _disclaimer_box(),
        Spacer(1, 12),
        Paragraph("Portfolio-Zusammensetzung", _H2),
        _weights_table(weights),
        Paragraph("Risiko-Score", _H2),
        _score_table(analysis),
        Paragraph("Risiko-Ampel", _H2),
    ]
    for ampel in ampeln:
        story.extend(_ampel_block(ampel))

    if stress is not None:
        story.append(Paragraph("Historischer Stress-Test", _H2))
        story.extend(_stress_section(stress))

    doc.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
    return buffer.getvalue()


def _disclaimer_box() -> Table:
    cell = Paragraph(DISCLAIMER_TEXT, _DISCLAIMER_STYLE)
    table = Table([[cell]], colWidths=[_PAGE_WIDTH - 2 * _MARGIN])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def _base_table_style() -> TableStyle:
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
            (
                "ROWBACKGROUNDS",
                (0, 1),
                (-1, -1),
                [colors.white, colors.HexColor("#f8fafc")],
            ),
        ]
    )


def _weights_table(weights: dict[str, float]) -> Table:
    total = sum(weights.values()) or 1.0
    rows = [["Ticker", "Gewicht"]]
    for ticker, weight in sorted(weights.items(), key=lambda kv: kv[1], reverse=True):
        rows.append([ticker, f"{weight / total * 100:.1f} %"])
    table = Table(rows, colWidths=[8 * cm, 4 * cm])
    table.setStyle(_base_table_style())
    return table


def _score_table(analysis: RiskAnalyzeOut) -> Table:
    score = analysis.score
    rows = [
        ["Score", f"{score.score:.0f} / 100"],
        ["Einstufung", score.label],
    ]
    for driver in score.drivers[:3]:
        rows.append([driver.factor, f"{driver.contribution * 100:.0f} %"])
    table = Table(rows, colWidths=[8 * cm, 4 * cm])
    table.setStyle(_base_table_style())
    return table


def _ampel_block(ampel: AmpelOut) -> list:
    color = _STATUS_COLORS[ampel.status]
    label = _STATUS_LABELS[ampel.status]
    title_style = ParagraphStyle(
        f"AmpelTitle-{ampel.id}", parent=_AMPEL_TITLE_BASE, textColor=color
    )
    return [
        Paragraph(f"<b>{xml_escape(ampel.title)}</b> ({label})", title_style),
        Paragraph(xml_escape(ampel.explanation), _BODY),
        Paragraph(f"<i>Was heißt das?</i> {xml_escape(ampel.lesson)}", _SMALL),
        Spacer(1, 4),
    ]


def _stress_section(stress: StressReplayOut) -> list:
    period_text = (
        f"Zeitraum {stress.start.strftime('%d.%m.%Y')} bis "
        f"{stress.end.strftime('%d.%m.%Y')}. Maximaler Rückgang "
        f"{stress.max_drawdown * 100:.0f} %, Gesamtrendite "
        f"{stress.total_return * 100:.0f} %, Abdeckung "
        f"{stress.coverage * 100:.0f} % des Depots."
    )
    return [
        Paragraph(f"Szenario: {xml_escape(stress.title)}", _BODY),
        Paragraph(xml_escape(period_text), _BODY),
        Paragraph(xml_escape(stress.explanation), _BODY),
        Spacer(1, 8),
        _stress_chart_drawing(stress.dates, stress.value_path),
        Spacer(1, 4),
        Paragraph(xml_escape(stress.disclaimer), _SMALL),
    ]


def _stress_chart_drawing(dates: list[date], value_path: list[float]) -> Drawing:
    # Downsample: value_path can hold ~370 daily points, far more than a
    # small paper chart needs (and reportlab's category axis gets
    # unreadable past a few dozen ticks).
    step = max(1, len(value_path) // 80)
    sampled = value_path[::step]
    sample_dates = dates[::step]

    drawing = Drawing(440, 150)
    chart = HorizontalLineChart()
    chart.x, chart.y = 40, 30
    chart.width, chart.height = 380, 100
    chart.data = [sampled]
    chart.lines[0].strokeColor = colors.HexColor("#334155")
    chart.lines[0].strokeWidth = 1.4
    value_min, value_max = min(sampled), max(sampled)
    padding = (value_max - value_min) * 0.08 or 0.02
    chart.valueAxis.valueMin = value_min - padding
    chart.valueAxis.valueMax = value_max + padding
    chart.valueAxis.labelTextFormat = "%0.2f"
    chart.valueAxis.labels.fontSize = 7

    labels = ["" for _ in sampled]
    if labels:
        labels[0] = sample_dates[0].strftime("%m/%Y")
        labels[-1] = sample_dates[-1].strftime("%m/%Y")
    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontSize = 7
    chart.categoryAxis.visibleTicks = False

    drawing.add(chart)
    return drawing


def _draw_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#64748b"))
    lines = simpleSplit(DISCLAIMER_TEXT, "Helvetica", 7, _PAGE_WIDTH - 2 * _MARGIN)
    y = 1.7 * cm
    for line in lines:
        canvas.drawString(_MARGIN, y, line)
        y -= 0.3 * cm
    canvas.drawRightString(_PAGE_WIDTH - _MARGIN, 1.7 * cm, f"Seite {doc.page}")
    canvas.restoreState()
