#!/usr/bin/env python3
"""Render a vertical Codex photo-edit process animation for TikTok."""

from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1080
HEIGHT = 1920
DURATION = 6.4
FPS = 30

INK = (13, 16, 17)
INK_2 = (25, 29, 29)
PAPER = (239, 234, 220)
PAPER_2 = (215, 209, 194)
BLUE = (42, 87, 214)
OCHRE = (234, 156, 55)
MUTED = (151, 157, 153)
WHITE = (249, 247, 239)

SANS = "/System/Library/Fonts/SFNS.ttf"
MONO = "/System/Library/Fonts/SFNSMono.ttf"
SERIF = "/System/Library/Fonts/NewYork.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


F10 = font(MONO, 21)
F12 = font(MONO, 25)
F16 = font(MONO, 33)
F24 = font(SANS, 48)
F36 = font(SANS, 76)
F48 = font(SANS, 104)
F64 = font(SANS, 138)
SERIF_36 = font(SERIF, 80)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease(value: float) -> float:
    value = clamp(value)
    return 1 - (1 - value) ** 3


def ease_in_out(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def local(t: float, start: float, end: float) -> float:
    return clamp((t - start) / (end - start))


def lerp(a: float, b: float, value: float) -> float:
    return a + (b - a) * value


def fit_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    image = image.convert("RGB")
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize(
        (math.ceil(image.width * scale), math.ceil(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def fit_contain(image: Image.Image, size: tuple[int, int], color=PAPER) -> Image.Image:
    image = image.convert("RGB")
    scale = min(size[0] / image.width, size[1] / image.height)
    resized = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    result = Image.new("RGB", size, color)
    result.paste(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
    return result


def with_opacity(image: Image.Image, opacity: float) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A").point(lambda value: int(value * clamp(opacity)))
    rgba.putalpha(alpha)
    return rgba


def paste_center(
    base: Image.Image,
    layer: Image.Image,
    center: tuple[float, float],
    scale: float = 1.0,
    angle: float = 0.0,
    opacity: float = 1.0,
) -> None:
    width = max(1, round(layer.width * scale))
    height = max(1, round(layer.height * scale))
    transformed = layer.resize((width, height), Image.Resampling.LANCZOS)
    if angle:
        transformed = transformed.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    if opacity < 0.999:
        transformed = with_opacity(transformed, opacity)
    left = round(center[0] - transformed.width / 2)
    top = round(center[1] - transformed.height / 2)
    base.alpha_composite(transformed.convert("RGBA"), (left, top))


def shadowed_card(content: Image.Image, label: str, size=(900, 690)) -> Image.Image:
    card = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((20, 25, size[0] - 10, size[1] - 10), 14, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    card.alpha_composite(shadow)
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle((8, 8, size[0] - 28, size[1] - 28), 10, fill=PAPER)
    photo_box = (28, 28, size[0] - 48, size[1] - 94)
    photo = fit_cover(content, (photo_box[2] - photo_box[0], photo_box[3] - photo_box[1]))
    card.paste(photo, (photo_box[0], photo_box[1]))
    draw.text((30, size[1] - 76), label, font=F12, fill=INK)
    return card


def clean_photo_card(content: Image.Image, size=(740, 570)) -> Image.Image:
    """A quiet, label-free print used by the short social cut."""
    card = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((20, 24, size[0] - 12, size[1] - 10), 12, fill=(0, 0, 0, 150))
    card.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle((8, 8, size[0] - 26, size[1] - 26), 8, fill=PAPER)
    photo_box = (24, 24, size[0] - 42, size[1] - 42)
    photo = fit_cover(content, (photo_box[2] - photo_box[0], photo_box[3] - photo_box[1]))
    card.paste(photo, (photo_box[0], photo_box[1]))
    return card


def spread_card(content: Image.Image, size=(980, 700)) -> Image.Image:
    card = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.rounded_rectangle((22, 26, size[0] - 16, size[1] - 16), 12, fill=(0, 0, 0, 155))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    card.alpha_composite(shadow)
    paper = fit_contain(content, (size[0] - 62, size[1] - 62), PAPER)
    card.paste(paper, (20, 18))
    return card


def draw_tracking(draw: ImageDraw.ImageDraw, xy, text, chosen_font, fill, tracking=2):
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=chosen_font, fill=fill)
        x += draw.textlength(char, font=chosen_font) + tracking


def draw_corner_box(draw: ImageDraw.ImageDraw, box, color, width=4, length=28):
    x0, y0, x1, y1 = box
    lines = [
        (x0, y0, x0 + length, y0), (x0, y0, x0, y0 + length),
        (x1, y0, x1 - length, y0), (x1, y0, x1, y0 + length),
        (x0, y1, x0 + length, y1), (x0, y1, x0, y1 - length),
        (x1, y1, x1 - length, y1), (x1, y1, x1, y1 - length),
    ]
    for line in lines:
        draw.line(line, fill=color, width=width)


def make_background() -> Image.Image:
    bg = Image.new("RGBA", (WIDTH, HEIGHT), INK + (255,))
    pixels = bg.load()
    for y in range(HEIGHT):
        mix = y / HEIGHT
        for x in range(WIDTH):
            radial = max(0.0, 1 - math.hypot((x - WIDTH * 0.5) / 800, (y - HEIGHT * 0.43) / 1250))
            grain = ((x * 13 + y * 7) % 17) / 17
            lift = int(13 * radial + 2 * grain + 5 * mix)
            pixels[x, y] = (INK[0] + lift, INK[1] + lift, INK[2] + lift, 255)
    return bg


def make_mosaic(photos: list[Image.Image]) -> tuple[Image.Image, list[tuple[int, int, int, int]]]:
    width, height = 960, 1260
    mosaic = Image.new("RGBA", (width, height), PAPER_2 + (255,))
    draw = ImageDraw.Draw(mosaic)
    boxes = []
    cols, rows = 4, 4
    gap = 14
    cell_w = (width - gap * (cols + 1)) // cols
    cell_h = (height - gap * (rows + 1)) // rows
    for index, photo in enumerate(photos):
        col = index % cols
        row = index // cols
        x = gap + col * (cell_w + gap)
        y = gap + row * (cell_h + gap)
        image_box = (x, y, x + cell_w, y + cell_h - 32)
        thumb = fit_cover(photo, (cell_w, cell_h - 32))
        mosaic.paste(thumb, (x, y))
        draw.text((x + 5, y + cell_h - 29), f"{index + 1:02d}", font=F10, fill=INK)
        boxes.append(image_box)
    return mosaic, boxes


class Assets:
    def __init__(self, root: Path):
        result = root / "evals/results/death-valley/20260826T174024885533Z-death-valley-64a0a46487/workspace"
        inputs = result / "input"
        spread_dir = result / "assets/spreads"
        names = ["image.png", "image copy.png"] + [f"image copy {i}.png" for i in range(2, 16)]
        self.photos = [Image.open(inputs / name).convert("RGB") for name in names]
        spread_names = [
            "spread-00-cover.png",
            "spread-01-first-light.png",
            "spread-02-at-the-edge.png",
            "spread-03-salt-distance.png",
            "spread-04-afterglow.png",
            "spread-05-small-figures.png",
            "spread-06-looking-back.png",
        ]
        self.spreads = [Image.open(spread_dir / name).convert("RGB") for name in spread_names]
        self.mosaic, self.mosaic_boxes = make_mosaic(self.photos)
        self.photo_cards = [
            shadowed_card(self.photos[0], "01  /  LIGHT + LAND FORM"),
            shadowed_card(self.photos[1], "02  /  DEPTH + HUMAN SCALE"),
        ]
        self.clean_cards = [clean_photo_card(photo) for photo in self.photos]
        self.spread_cards = [spread_card(spread) for spread in self.spreads]


def top_chrome(frame: Image.Image, t: float, section: str):
    draw = ImageDraw.Draw(frame)
    draw_tracking(draw, (70, 64), "CODEX / VISUAL EDIT", F10, WHITE, 1)
    draw.text((WIDTH - 70, 64), f"{t:05.2f}", font=F10, fill=MUTED, anchor="ra")
    draw.line((70, 106, WIDTH - 70, 106), fill=(255, 255, 255, 45), width=1)
    draw.text((70, 126), section, font=F10, fill=OCHRE)


def intro_scene(t: float, assets: Assets, bg: Image.Image) -> Image.Image:
    frame = bg.copy()
    draw = ImageDraw.Draw(frame)
    p = ease(local(t, 0.0, 0.7))
    top_chrome(frame, t, "INPUT / DEATH VALLEY")
    draw.text((70, 470 + (1 - p) * 90), "CODEX", font=F64, fill=WHITE)
    draw.text((74, 620 + (1 - p) * 70), "IS LOOKING", font=F48, fill=PAPER_2)
    draw.text((76, 760 + (1 - p) * 50), "FOR A BOOK", font=SERIF_36, fill=OCHRE)
    line_p = ease(local(t, 0.35, 1.0))
    draw.line((74, 920, 74 + 820 * line_p, 920), fill=BLUE, width=8)
    draw.text((78, 968), "16 RAW PHOTOGRAPHS", font=F16, fill=MUTED)
    draw.text((78, 1020), "NO SEQUENCE YET", font=F12, fill=MUTED)
    return frame


def inspect_scene(t: float, assets: Assets, bg: Image.Image) -> Image.Image:
    frame = bg.copy()
    top_chrome(frame, t, "01 / INSPECT")
    p = ease(local(t, 0.9, 1.45))
    y = lerp(2150, 1050, p) - 35 * math.sin(local(t, 1.2, 3.4) * math.pi)
    paste_center(frame, assets.mosaic, (WIDTH / 2, y), scale=0.94)
    draw = ImageDraw.Draw(frame)
    scan = ease_in_out(local(t, 1.35, 3.15))
    scan_y = round(370 + scan * 1220)
    glow = Image.new("RGBA", (WIDTH, 90), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rectangle((0, 35, WIDTH, 55), fill=BLUE + (100,))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    frame.alpha_composite(glow, (0, scan_y - 45))
    draw.line((40, scan_y, WIDTH - 40, scan_y), fill=BLUE, width=3)
    mosaic_left = (WIDTH - round(assets.mosaic.width * 0.94)) // 2
    mosaic_top = round(y - assets.mosaic.height * 0.94 / 2)
    for index, color in [(0, OCHRE), (1, BLUE), (3, OCHRE), (7, BLUE)]:
        source = assets.mosaic_boxes[index]
        box = tuple(round(value * 0.94) for value in source)
        x0, y0, x1, y1 = box
        translated = (mosaic_left + x0, mosaic_top + y0, mosaic_left + x1, mosaic_top + y1)
        if scan_y > translated[1] + 45:
            draw_corner_box(draw, translated, color, width=4)
    draw.text((70, 1710), "READING LIGHT / SCALE / REPETITION", font=F12, fill=WHITE)
    draw.text((70, 1760), "4 CANDIDATES FLAGGED", font=F10, fill=MUTED)
    return frame


def compare_scene(t: float, assets: Assets, bg: Image.Image) -> Image.Image:
    frame = bg.copy()
    top_chrome(frame, t, "02 / COMPARE")
    enter = ease(local(t, 3.25, 3.72))
    center_y = 930
    scale = 0.93 + 0.025 * math.sin(local(t, 3.4, 5.6) * math.pi)
    x = lerp(-520, WIDTH / 2, enter)
    paste_center(frame, assets.photo_cards[0], (x, center_y), scale=scale, angle=lerp(-6, -1.2, enter))

    wipe = ease_in_out(local(t, 4.28, 4.95))
    if wipe > 0:
        card = assets.photo_cards[1]
        scaled = card.resize((round(card.width * scale), round(card.height * scale)), Image.Resampling.LANCZOS)
        cut = round(scaled.width * (1 - wipe))
        visible = scaled.crop((cut, 0, scaled.width, scaled.height))
        left = round(WIDTH / 2 - scaled.width / 2 + cut)
        top = round(center_y - scaled.height / 2)
        frame.alpha_composite(visible, (left, top))
        line_x = left
        draw = ImageDraw.Draw(frame)
        draw.line((line_x, top - 18, line_x, top + scaled.height + 18), fill=BLUE, width=6)

    draw = ImageDraw.Draw(frame)
    tag_p = ease(local(t, 3.7, 4.15))
    draw.text((70, 1435), "01", font=F48, fill=OCHRE if wipe < 0.5 else MUTED)
    draw.text((230, 1455), "→", font=F36, fill=BLUE)
    draw.text((350, 1435), "02", font=F48, fill=BLUE if wipe >= 0.5 else MUTED)
    draw.line((70, 1572, 70 + 800 * tag_p, 1572), fill=(255, 255, 255, 70), width=2)
    draw.text((70, 1612), "MATCH: WARM RIDGE / DEEP SHADOW", font=F12, fill=WHITE)
    draw.text((70, 1660), "ROLE: OPENING TEMPO", font=F10, fill=MUTED)
    return frame


def arrange_scene(t: float, assets: Assets, bg: Image.Image) -> Image.Image:
    frame = bg.copy()
    top_chrome(frame, t, "03 / ARRANGE")
    gather = ease_in_out(local(t, 5.45, 6.15))
    left_x = lerp(-160, 300, gather)
    right_x = lerp(1240, 780, gather)
    y = lerp(990, 800, gather)
    opacity = 1 - ease(local(t, 6.3, 6.85))
    paste_center(frame, assets.photo_cards[0], (left_x, y), scale=0.52, angle=lerp(-8, -2, gather), opacity=opacity)
    paste_center(frame, assets.photo_cards[1], (right_x, y), scale=0.52, angle=lerp(8, 2, gather), opacity=opacity)
    draw = ImageDraw.Draw(frame)
    gutter = ease(local(t, 5.78, 6.35))
    draw.line((540, 515, 540, 515 + 610 * gutter), fill=BLUE, width=4)
    draw.text((70, 1470), "PAIR", font=F24, fill=OCHRE)
    draw.text((235, 1470), "→", font=F24, fill=MUTED)
    draw.text((330, 1470), "GUTTER", font=F24, fill=BLUE)
    draw.text((610, 1470), "→", font=F24, fill=MUTED)
    draw.text((705, 1470), "PACE", font=F24, fill=WHITE)

    reveal = ease(local(t, 6.25, 7.25))
    if reveal > 0:
        paste_center(
            frame,
            assets.spread_cards[1],
            (WIDTH / 2, lerp(1160, 890, reveal)),
            scale=lerp(0.28, 0.98, reveal),
            angle=lerp(5, 0, reveal),
            opacity=reveal,
        )
    draw.text((70, 1740), "THE FIRST SPREAD FINDS ITS RHYTHM", font=F12, fill=WHITE)
    return frame


def sequence_scene(t: float, assets: Assets, bg: Image.Image) -> Image.Image:
    frame = bg.copy()
    top_chrome(frame, t, "04 / SEQUENCE")
    elapsed = max(0, t - 7.35)
    slot = min(5, int(elapsed / 0.48))
    transition = ease_in_out((elapsed % 0.48) / 0.48)
    indices = [2, 3, 4, 5, 6, 0]
    previous = indices[max(0, slot - 1)]
    current = indices[slot]
    if slot == 0:
        previous = 1
    prev_x = lerp(WIDTH / 2, -650, transition)
    next_x = lerp(1650, WIDTH / 2, transition)
    paste_center(frame, assets.spread_cards[previous], (prev_x, 900), scale=0.96, angle=-2 * transition)
    paste_center(frame, assets.spread_cards[current], (next_x, 900), scale=0.96, angle=2 * (1 - transition))
    draw = ImageDraw.Draw(frame)
    count = min(7, slot + 2)
    draw.text((70, 1450), f"{count:02d} / 07", font=F48, fill=WHITE)
    labels = ["AT THE EDGE", "SALT + DISTANCE", "AFTERGLOW", "SMALL FIGURES", "LOOKING BACK", "COVER"]
    draw.text((70, 1570), labels[slot], font=F16, fill=OCHRE)
    bar = 940 * (count / 7)
    draw.rounded_rectangle((70, 1660, 1010, 1670), 5, fill=(255, 255, 255, 40))
    draw.rounded_rectangle((70, 1660, 70 + bar, 1670), 5, fill=BLUE)
    draw.text((70, 1710), "SEQUENCE / CONTRAST / BREATH", font=F10, fill=MUTED)
    return frame


def final_scene(t: float, assets: Assets, bg: Image.Image) -> Image.Image:
    frame = bg.copy()
    top_chrome(frame, t, "OUTPUT / PHOTOBOOK")
    p = ease(local(t, 10.05, 10.85))
    settle = ease_in_out(local(t, 10.7, 11.35))
    center_y = lerp(1120, 780, p)
    paste_center(frame, assets.spread_cards[4], (540, center_y + 80), scale=0.76 * p, angle=-7 + 3 * settle, opacity=p)
    paste_center(frame, assets.spread_cards[2], (540, center_y + 42), scale=0.79 * p, angle=6 - 2 * settle, opacity=p)
    paste_center(frame, assets.spread_cards[0], (540, center_y), scale=0.84 * p, angle=-1 + settle, opacity=p)
    draw = ImageDraw.Draw(frame)
    text_p = ease(local(t, 10.75, 11.35))
    y = lerp(1720, 1370, text_p)
    draw.text((70, y), "16 PHOTOS", font=F36, fill=WHITE)
    draw.text((70, y + 92), "07 SPREADS", font=F36, fill=OCHRE)
    draw.text((70, y + 184), "01 PHOTOBOOK", font=F36, fill=BLUE)
    draw.line((70, y + 292, 970, y + 292), fill=(255, 255, 255, 55), width=2)
    draw.text((70, y + 328), "INSPECTED + ARRANGED WITH CODEX", font=F10, fill=MUTED)
    return frame


def minimal_scene(t: float, assets: Assets, bg: Image.Image) -> Image.Image:
    """One continuous, text-free edit: inspect, compare, arrange, reveal."""
    frame = bg.copy()

    # Twelve loose prints settle into a clean contact grid.
    grid_x = (210, 540, 870)
    grid_y = (350, 745, 1140, 1535)
    grid_fade = 1 - ease(local(t, 1.48, 1.92))
    selected_hold = 1 - ease(local(t, 1.72, 2.08))
    for index in reversed(range(12)):
        col, row = index % 3, index // 3
        target = (grid_x[col], grid_y[row])
        theta = index * 1.71
        start = (
            WIDTH / 2 + math.cos(theta) * (850 + 80 * (index % 3)),
            HEIGHT / 2 + math.sin(theta) * (1220 + 70 * (index % 4)),
        )
        arrive = ease(local(t, index * 0.025, 0.58 + index * 0.025))
        center = (lerp(start[0], target[0], arrive), lerp(start[1], target[1], arrive))
        selected = index in (0, 1)
        opacity = selected_hold if selected else grid_fade
        scale = 0.42 * lerp(0.78, 1.0, arrive)
        angle = lerp(((index % 5) - 2) * 8, 0, arrive)
        if opacity > 0.01:
            paste_center(frame, assets.clean_cards[index], center, scale=scale, angle=angle, opacity=opacity)

    # A restrained scan passes once; the two candidates answer with colored corners.
    scan = ease_in_out(local(t, 0.52, 1.40))
    scan_y = round(190 + scan * 1510)
    if t < 1.55:
        glow = Image.new("RGBA", (WIDTH, 64), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.rectangle((0, 29, WIDTH, 35), fill=BLUE + (115,))
        frame.alpha_composite(glow.filter(ImageFilter.GaussianBlur(12)), (0, scan_y - 32))
        ImageDraw.Draw(frame).line((45, scan_y, WIDTH - 45, scan_y), fill=BLUE, width=2)
    if 0.65 < t < 1.72:
        d = ImageDraw.Draw(frame)
        for index, color in ((0, OCHRE), (1, BLUE)):
            cx, cy = grid_x[index % 3], grid_y[index // 3]
            if scan_y > cy - 130:
                draw_corner_box(d, (cx - 151, cy - 111, cx + 151, cy + 111), color, width=3, length=22)

    # Photo 01 grows out of the grid, then photo 02 wipes across it.
    focus = ease(local(t, 1.52, 2.05))
    focus_scale = lerp(0.42, 1.22, focus)
    focus_center = (lerp(grid_x[0], WIDTH / 2, focus), lerp(grid_y[0], 825, focus))
    if focus > 0:
        paste_center(frame, assets.clean_cards[0], focus_center, scale=focus_scale, opacity=focus)

    wipe = ease_in_out(local(t, 2.08, 2.62))
    if wipe > 0:
        card = assets.clean_cards[1].resize(
            (round(assets.clean_cards[1].width * 1.22), round(assets.clean_cards[1].height * 1.22)),
            Image.Resampling.LANCZOS,
        )
        visible_width = max(1, round(card.width * wipe))
        visible = card.crop((card.width - visible_width, 0, card.width, card.height))
        left = round(WIDTH / 2 + card.width / 2 - visible_width)
        top = round(825 - card.height / 2)
        frame.alpha_composite(visible, (left, top))
        seam_x = round(WIDTH / 2 + card.width / 2 - visible_width)
        ImageDraw.Draw(frame).line((seam_x, top - 10, seam_x, top + card.height + 10), fill=BLUE, width=3)

    # The comparison separates into a pair, then resolves directly into the designed spread.
    pair = ease_in_out(local(t, 2.62, 3.18))
    if pair > 0:
        opacity = 1 - ease(local(t, 3.18, 3.62))
        pair_scale = lerp(1.22, 0.62, pair)
        left_center = (lerp(WIDTH / 2, 295, pair), lerp(825, 860, pair))
        right_center = (lerp(WIDTH / 2, 785, pair), lerp(825, 860, pair))
        paste_center(frame, assets.clean_cards[0], left_center, scale=pair_scale, angle=lerp(0, -1.5, pair), opacity=opacity)
        paste_center(frame, assets.clean_cards[1], right_center, scale=pair_scale, angle=lerp(0, 1.5, pair), opacity=opacity)
        gutter = ease(local(t, 2.82, 3.25)) * opacity
        if gutter > 0:
            line = Image.new("RGBA", frame.size, (0, 0, 0, 0))
            ImageDraw.Draw(line).line((540, 545, 540, 1175), fill=BLUE + (round(190 * gutter),), width=3)
            frame.alpha_composite(line)

    spread_reveal = ease(local(t, 3.18, 3.78))
    if spread_reveal > 0:
        paste_center(
            frame,
            assets.spread_cards[1],
            (WIDTH / 2, lerp(930, 825, spread_reveal)),
            scale=lerp(0.38, 0.98, spread_reveal),
            angle=lerp(3, 0, spread_reveal),
            opacity=spread_reveal,
        )

    # Three quick page replacements imply sequencing without adding UI.
    if 3.78 <= t < 5.12:
        elapsed = t - 3.78
        slot_length = 0.335
        slot = min(3, int(elapsed / slot_length))
        phase = ease_in_out((elapsed % slot_length) / slot_length)
        order = (1, 3, 4, 6, 0)
        previous, current = order[slot], order[slot + 1]
        paste_center(frame, assets.spread_cards[previous], (lerp(WIDTH / 2, -600, phase), 825), scale=0.98, angle=-1.5 * phase)
        paste_center(frame, assets.spread_cards[current], (lerp(1680, WIDTH / 2, phase), 825), scale=0.98, angle=1.5 * (1 - phase))

    # The cover settles over a small physical stack and holds for the loop point.
    finish = ease(local(t, 4.92, 5.55))
    if finish > 0:
        center_y = lerp(980, 855, finish)
        paste_center(frame, assets.spread_cards[4], (540, center_y + 74), scale=0.77 * finish, angle=lerp(-7, -4, finish), opacity=finish)
        paste_center(frame, assets.spread_cards[2], (540, center_y + 38), scale=0.80 * finish, angle=lerp(7, 4, finish), opacity=finish)
        paste_center(frame, assets.spread_cards[0], (540, center_y), scale=0.86 * finish, angle=lerp(-3, 0, finish), opacity=finish)

    return frame.convert("RGB")


def render_frame(t: float, assets: Assets, bg: Image.Image) -> Image.Image:
    return minimal_scene(t, assets, bg)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("experiment/social/codex-photo-book-process.mp4"))
    parser.add_argument("--poster", type=Path, default=Path("experiment/social/codex-photo-book-process-poster.jpg"))
    parser.add_argument("--fps", type=int, default=FPS)
    parser.add_argument("--duration", type=float, default=DURATION)
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[2]
    output = args.output if args.output.is_absolute() else repo / args.output
    poster = args.poster if args.poster.is_absolute() else repo / args.poster
    output.parent.mkdir(parents=True, exist_ok=True)
    poster.parent.mkdir(parents=True, exist_ok=True)

    assets = Assets(repo)
    background = make_background()
    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{WIDTH}x{HEIGHT}", "-r", str(args.fps), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(output),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    total = round(args.duration * args.fps)
    poster_frame = min(total - 1, round(5.82 * args.fps))
    for index in range(total):
        current = render_frame(index / args.fps, assets, background)
        if index == poster_frame:
            current.save(poster, quality=94, subsampling=0)
        process.stdin.write(current.tobytes())
        if index % args.fps == 0:
            print(f"rendered {index // args.fps:02d}s / {args.duration:.1f}s", flush=True)
    process.stdin.close()
    code = process.wait()
    if code:
        raise SystemExit(code)
    print(output)


if __name__ == "__main__":
    main()
