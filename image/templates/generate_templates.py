#!/usr/bin/env python3
"""
生成减肥搭子 APP 图标 / 启动图模板
用法：
    source .venv/bin/activate
    python image/templates/generate_templates.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"

# 品牌色
PRIMARY = "#8DBB77"
PRIMARY_DARK = "#6FA85C"
TEXT_DARK = "#333333"
TEXT_GRAY = "#666666"


def load_font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception as e:
        print(f"加载字体失败: {e}, 使用默认字体")
        return ImageFont.load_default()


def rounded_rectangle(draw, xy, radius, fill):
    """绘制圆角矩形"""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def draw_leaf(draw, center, size, color):
    """绘制简单叶子图标"""
    cx, cy = center
    # 叶片：椭圆
    leaf_w = int(size * 0.55)
    leaf_h = int(size * 0.85)
    draw.ellipse(
        [cx - leaf_w // 2, cy - leaf_h // 2, cx + leaf_w // 2, cy + leaf_h // 2],
        fill=color
    )
    # 叶脉
    draw.line(
        [(cx, cy - leaf_h // 2 + size * 0.08), (cx, cy + leaf_h // 2 - size * 0.08)],
        fill=(255, 255, 255, 128),
        width=max(2, size // 40)
    )
    # 茎
    stem_h = int(size * 0.25)
    draw.line(
        [(cx, cy + leaf_h // 2), (cx, cy + leaf_h // 2 + stem_h)],
        fill=color,
        width=max(4, size // 25)
    )


def make_icon(size, adaptive=False, foreground=False, background=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if background:
        # Android 自适应图标背景：纯色
        draw.rectangle([0, 0, size, size], fill=PRIMARY)
        return img

    if foreground:
        # Android 自适应图标前景：只保留叶子
        padding = int(size * 0.22)
        leaf_size = size - padding * 2
        draw_leaf(draw, (size // 2, size // 2), leaf_size, "white")
        return img

    # 完整图标：圆角方形背景 + 叶子
    radius = int(size * 0.22)
    rounded_rectangle(draw, [0, 0, size, size], radius, PRIMARY)
    padding = int(size * 0.22)
    leaf_size = size - padding * 2
    draw_leaf(draw, (size // 2, size // 2), leaf_size, "white")
    return img


def make_splash(width, height):
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    # 中心叶子
    icon_size = min(width, height) // 5
    center_x = width // 2
    center_y = height // 2 - height // 14
    draw_leaf(draw, (center_x, center_y), icon_size, PRIMARY)

    # 标题
    font_title = load_font(width // 12)
    title = "减肥搭子"
    bbox = draw.textbbox((0, 0), title, font=font_title)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((center_x - tw // 2, center_y + icon_size // 2 + height // 40),
              title, fill=TEXT_DARK, font=font_title)

    # 副标题
    font_sub = load_font(width // 28)
    subtitle = "你的专属 AI 减肥搭子"
    bbox2 = draw.textbbox((0, 0), subtitle, font=font_sub)
    sw = bbox2[2] - bbox2[0]
    draw.text((center_x - sw // 2, center_y + icon_size // 2 + height // 40 + th + height // 60),
              subtitle, fill=TEXT_GRAY, font=font_sub)

    # 底部占位提示
    font_tip = load_font(width // 40)
    tip = "【启动页模板，可替换为品牌视觉图】"
    bbox3 = draw.textbbox((0, 0), tip, font=font_tip)
    tiw = bbox3[2] - bbox3[0]
    draw.text((center_x - tiw // 2, height - height // 12),
              tip, fill="#999999", font=font_tip)

    return img


def save(name, img):
    path = os.path.join(BASE_DIR, name)
    img.save(path)
    print(f"已生成: {path}")


def main():
    # 图标
    save("icon_1024x1024.png", make_icon(1024))
    save("icon_512x512.png", make_icon(512))
    save("icon_foreground_1024.png", make_icon(1024, foreground=True))
    save("icon_background_1024.png", make_icon(1024, background=True))

    # 启动图
    splash_sizes = [
        (1242, 2208),
        (1125, 2436),
        (1170, 2532),
        (1080, 1920),
    ]
    for w, h in splash_sizes:
        save(f"splash_{w}x{h}.png", make_splash(w, h))


if __name__ == "__main__":
    main()
