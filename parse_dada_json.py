import json
import sys

with open('/Users/yanqian/Desktop/练习项目/fit/shejigao/搭搭json.json', 'r') as f:
    data = json.load(f)

root = data['nodes'][0]

items = []

def flatten(node, parent_x=0, parent_y=0):
    x = parent_x + node.get('position', {}).get('x', 0)
    y = parent_y + node.get('position', {}).get('y', 0)
    style = node.get('style', {})
    width = style.get('width', 0)
    height = style.get('height', 0)
    name = node.get('name', '')
    ntype = node.get('type', '')
    text = node.get('text', {})
    asset = node.get('asset', {})
    background = style.get('background', '')
    border_radius = style.get('borderRadius', 0)
    border = style.get('border', '')
    color = text.get('color', '') if text else ''
    font_size = text.get('fontSize', '') if text else ''
    font_weight = text.get('fontWeight', '') if text else ''
    content = text.get('content', '') if text else ''
    box_shadow = style.get('boxShadow', '')

    # Only emit leaf nodes or meaningful containers
    # For GROUP and FRAME, emit children; but also emit the group itself if it has style (e.g., background)
    if ntype in ('RECTANGLE', 'PEN', 'TEXT'):
        items.append({
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
            'asset': asset.get('type') if asset else '',
        })
    elif ntype in ('GROUP', 'FRAME') and (background or width or height):
        # emit container if it has visual style
        items.append({
            'name': name,
            'type': ntype,
            'x': x,
            'y': y,
            'width': width,
            'height': height,
            'background': background,
            'borderRadius': border_radius,
            'border': border,
            'color': '',
            'fontSize': '',
            'fontWeight': '',
            'content': '',
            'boxShadow': box_shadow,
            'asset': '',
        })

    for child in node.get('children', []):
        flatten(child, x, y)

flatten(root)

# Print as markdown table
print('| name | type | x | y | width | height | background | borderRadius | border | text | fontSize | color | shadow |')
print('|------|------|---|---|-------|--------|------------|--------------|--------|------|----------|-------|--------|')
for item in items:
    text = item['content'].replace('\n', '\\n').replace('|', '\\|')[:30]
    bg = str(item['background'])[:40]
    print(f"| {item['name'][:20]} | {item['type']} | {item['x']} | {item['y']} | {item['width']} | {item['height']} | {bg} | {item['borderRadius']} | {item['border']} | {text} | {item['fontSize']} | {item['color']} | {item['boxShadow'][:20]} |")

# Also print names list for quick reference
print('\n--- Names ---')
for item in items:
    print(f"{item['name']}: {item['type']} ({item['x']}, {item['y']}) {item['width']}x{item['height']}")
