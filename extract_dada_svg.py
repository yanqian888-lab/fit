import json
import os
import re
import base64
from pathlib import Path

SRC = '/Users/yanqian/Desktop/练习项目/fit/shejigao/搭搭json.json'
OUT_DIR = '/Users/yanqian/Desktop/练习项目/fit/frontend/static/svg/dada'
Path(OUT_DIR).mkdir(parents=True, exist_ok=True)

with open(SRC, 'r') as f:
    data = json.load(f)

root = data['nodes'][0]

svg_index = 0

def sanitize_name(name):
    return re.sub(r'[^\w\-]', '_', name).strip('_')[:40]

def save_svg(node, x, y):
    global svg_index
    asset = node.get('asset', {})
    if asset.get('type') == 'svg':
        svg_index += 1
        name = sanitize_name(node.get('name', f'svg_{svg_index}'))
        filename = f'{svg_index:03d}_{name}.svg'
        filepath = os.path.join(OUT_DIR, filename)
        with open(filepath, 'w') as f:
            f.write(asset['svg'])
        return f'/static/svg/dada/{filename}'
    return None

def save_image(node, x, y):
    asset = node.get('asset', {})
    if asset.get('type') == 'image':
        # Don't save base64 images; use icon folder instead
        return None
    return None

items = []

def traverse(node, parent_x=0, parent_y=0):
    x = parent_x + node.get('position', {}).get('x', 0)
    y = parent_y + node.get('position', {}).get('y', 0)
    style = node.get('style', {}) or {}
    width = style.get('width', 0)
    height = style.get('height', 0)
    name = node.get('name', '')
    ntype = node.get('type', '')
    text = node.get('text', {}) or {}
    asset = node.get('asset', {})
    background = style.get('background', '')
    border_radius = style.get('borderRadius', 0)
    border = style.get('border', '')
    color = text.get('color', '') if text else ''
    font_size = text.get('fontSize', '') if text else ''
    font_weight = text.get('fontWeight', '') if text else ''
    content = text.get('content', '') if text else ''
    box_shadow = style.get('boxShadow', '')

    svg_src = None
    img_src = None
    if asset.get('type') == 'svg':
        svg_src = save_svg(node, x, y)
    elif asset.get('type') == 'image':
        img_src = 'image'

    item = {
        'name': name,
        'type': ntype,
        'x': x,
        'y': y,
        'width': width,
        'height': height,
        'background': background,
        'borderRadius': border_radius,
        'border': border,
        'color': color,
        'fontSize': font_size,
        'fontWeight': font_weight,
        'content': content,
        'boxShadow': box_shadow,
        'svg': svg_src,
        'image': img_src,
        'children': []
    }

    # Traverse children
    for child in node.get('children', []):
        child_item = traverse(child, x, y)
        if child_item:
            item['children'].append(child_item)

    return item

tree = traverse(root)

def flatten(tree, result=None):
    if result is None:
        result = []
    # Only emit visual leaves or nodes with assets/background/text
    has_visual = (
        tree['type'] in ('RECTANGLE', 'PEN', 'TEXT') or
        tree['svg'] or tree['image'] or
        tree['background'] or
        tree['content']
    )
    if has_visual:
        result.append(tree)
    for child in tree['children']:
        flatten(child, result)
    return result

flat = flatten(tree)

# Print summary table
print(f'Extracted {svg_index} SVGs to {OUT_DIR}')
print('\n| name | type | x | y | width | height | background | radius | border | text | fontSize | color | svg |')
print('|------|------|---|---|-------|--------|------------|--------|--------|------|----------|-------|-----|')
for item in flat:
    text = item['content'].replace('\n', '\\n').replace('|', '\\|')[:24]
    bg = str(item['background'])[:30]
    svg = item['svg'].split('/')[-1] if item['svg'] else ''
    print(f"| {item['name'][:20]} | {item['type']} | {item['x']} | {item['y']} | {item['width']} | {item['height']} | {bg} | {item['borderRadius']} | {item['border']} | {text} | {item['fontSize']} | {item['color']} | {svg} |")

# Also generate a simple JSON layout file for reference
layout_file = '/Users/yanqian/Desktop/练习项目/fit/dada_layout.json'
with open(layout_file, 'w') as f:
    json.dump(flat, f, ensure_ascii=False, indent=2)
print(f'\nLayout saved to {layout_file}')
