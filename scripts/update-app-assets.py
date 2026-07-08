#!/usr/bin/env python3
"""
根据 image/templates 中的素材，自动生成并替换前端 App 图标与启动页。
用法：
    source .venv/bin/activate
    python scripts/update-app-assets.py
"""
import json
import os
import shutil
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(BASE_DIR, 'image', 'templates')
DST_DIR = os.path.join(BASE_DIR, 'frontend', 'static', 'app')
MANIFEST_PATH = os.path.join(BASE_DIR, 'frontend', 'src', 'manifest.json')


def resize_png(src_path, dst_path, width, height=None):
    """等比或指定尺寸缩放 PNG"""
    if height is None:
        height = width
    with Image.open(src_path) as img:
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGBA')
        resized = img.resize((width, height), Image.LANCZOS)
        # 图标保持透明，启动图为不透明，统一按原模式保存
        resized.save(dst_path)


def ensure_dirs():
    os.makedirs(os.path.join(DST_DIR, 'icons'), exist_ok=True)
    os.makedirs(os.path.join(DST_DIR, 'splash', 'android'), exist_ok=True)
    os.makedirs(os.path.join(DST_DIR, 'splash', 'ios'), exist_ok=True)


def generate_icons():
    icon_src = os.path.join(SRC_DIR, 'icon_1024x1024.png')
    if not os.path.exists(icon_src):
        raise FileNotFoundError(f'缺少主图标素材: {icon_src}')

    # Android 应用图标
    android_icons = {
        'hdpi': 72,
        'xhdpi': 96,
        'xxhdpi': 144,
        'xxxhdpi': 192,
    }
    for name, size in android_icons.items():
        resize_png(icon_src, os.path.join(DST_DIR, 'icons', f'android_{name}.png'), size)
        print(f'[icon] android {name} ({size}x{size})')

    # iOS 应用图标（与官方 manifest 键名对应）
    ios_icons = {
        'appstore': 1024,
        'ipad_app': 76,
        'ipad_app@2x': 152,
        'ipad_proapp@2x': 167,
        'ipad_notification': 20,
        'ipad_notification@2x': 40,
        'ipad_settings': 29,
        'ipad_settings@2x': 58,
        'ipad_spotlight': 40,
        'ipad_spotlight@2x': 80,
        'iphone_app@2x': 120,
        'iphone_app@3x': 180,
        'iphone_notification@2x': 40,
        'iphone_notification@3x': 60,
        'iphone_settings@2x': 58,
        'iphone_settings@3x': 87,
        'iphone_spotlight@2x': 80,
        'iphone_spotlight@3x': 120,
    }
    for name, size in ios_icons.items():
        resize_png(icon_src, os.path.join(DST_DIR, 'icons', f'ios_{name}.png'), size)
        print(f'[icon] ios {name} ({size}x{size})')

    # 额外保留一份 512 商店图标和大 Logo
    resize_png(icon_src, os.path.join(DST_DIR, 'icons', 'icon_512x512.png'), 512)
    shutil.copy(os.path.join(SRC_DIR, 'logo.png'), os.path.join(DST_DIR, 'logo.png'))


def generate_splash():
    android_src = os.path.join(SRC_DIR, '1080*1920.png')
    if not os.path.exists(android_src):
        raise FileNotFoundError(f'缺少 Android 启动图素材: {android_src}')

    android_splashes = {
        'hdpi': (480, 800),
        'xhdpi': (720, 1280),
        'xxhdpi': (1080, 1920),
    }
    for name, (w, h) in android_splashes.items():
        resize_png(android_src, os.path.join(DST_DIR, 'splash', 'android', f'splash_{name}.png'), w, h)
        print(f'[splash] android {name} ({w}x{h})')

    # iOS 启动图：直接使用 templates 中提供的尺寸
    ios_splashes = {
        '1125*2436.png': 'splash_iphonex.png',     # 5.8 英寸 iPhone X/XS
        '1170*2532.png': 'splash_1170x2532.png',   # 6.1 英寸 iPhone 12/13/14 系列备用
        '1242*2208.png': 'splash_retina55.png',    # 5.5 英寸 iPhone 6/7/8 Plus
    }
    for src_name, dst_name in ios_splashes.items():
        src = os.path.join(SRC_DIR, src_name)
        dst = os.path.join(DST_DIR, 'splash', 'ios', dst_name)
        if os.path.exists(src):
            shutil.copy(src, dst)
            print(f'[splash] ios {dst_name}')
        else:
            print(f'[warn] 缺少 iOS 启动图素材: {src}')

    # 由 Android 启动图缩放生成其他常见 iPhone 尺寸
    extra_ios = {
        'splash_retina47.png': (750, 1334),   # 4.7 英寸 iPhone 6/7/8
        'splash_retina40.png': (640, 1136),   # 4.0 英寸 iPhone 5/SE
    }
    for dst_name, (w, h) in extra_ios.items():
        resize_png(android_src, os.path.join(DST_DIR, 'splash', 'ios', dst_name), w, h)
        print(f'[splash] ios {dst_name} ({w}x{h})')


def update_manifest():
    with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    app_plus = manifest.setdefault('app-plus', {})
    distribute = app_plus.setdefault('distribute', {})
    icons = distribute.setdefault('icons', {})

    icons['android'] = {
        'hdpi': 'static/app/icons/android_hdpi.png',
        'xhdpi': 'static/app/icons/android_xhdpi.png',
        'xxhdpi': 'static/app/icons/android_xxhdpi.png',
        'xxxhdpi': 'static/app/icons/android_xxxhdpi.png',
    }
    icons['ios'] = {
        'appstore': 'static/app/icons/ios_appstore.png',
        'ipad': {
            'app': 'static/app/icons/ios_ipad_app.png',
            'app@2x': 'static/app/icons/ios_ipad_app@2x.png',
            'proapp@2x': 'static/app/icons/ios_ipad_proapp@2x.png',
            'notification': 'static/app/icons/ios_ipad_notification.png',
            'notification@2x': 'static/app/icons/ios_ipad_notification@2x.png',
            'settings': 'static/app/icons/ios_ipad_settings.png',
            'settings@2x': 'static/app/icons/ios_ipad_settings@2x.png',
            'spotlight': 'static/app/icons/ios_ipad_spotlight.png',
            'spotlight@2x': 'static/app/icons/ios_ipad_spotlight@2x.png',
        },
        'iphone': {
            'app@2x': 'static/app/icons/ios_iphone_app@2x.png',
            'app@3x': 'static/app/icons/ios_iphone_app@3x.png',
            'notification@2x': 'static/app/icons/ios_iphone_notification@2x.png',
            'notification@3x': 'static/app/icons/ios_iphone_notification@3x.png',
            'settings@2x': 'static/app/icons/ios_iphone_settings@2x.png',
            'settings@3x': 'static/app/icons/ios_iphone_settings@3x.png',
            'spotlight@2x': 'static/app/icons/ios_iphone_spotlight@2x.png',
            'spotlight@3x': 'static/app/icons/ios_iphone_spotlight@3x.png',
        },
    }

    splash = distribute.setdefault('splashscreen', {})
    splash['androidStyle'] = 'common'
    splash['useOriginalMsgbox'] = True
    splash['android'] = {
        'hdpi': 'static/app/splash/android/splash_hdpi.png',
        'xhdpi': 'static/app/splash/android/splash_xhdpi.png',
        'xxhdpi': 'static/app/splash/android/splash_xxhdpi.png',
    }
    splash['ios'] = {
        'iphone': {
            'retina55': 'static/app/splash/ios/splash_retina55.png',
            'retina47': 'static/app/splash/ios/splash_retina47.png',
            'retina40': 'static/app/splash/ios/splash_retina40.png',
            'iphonex': 'static/app/splash/ios/splash_iphonex.png'
        }
    }

    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f'[manifest] 已更新: {MANIFEST_PATH}')


def main():
    ensure_dirs()
    generate_icons()
    generate_splash()
    update_manifest()
    print('\n✅ App 图标与启动页已替换完成')


if __name__ == '__main__':
    main()
