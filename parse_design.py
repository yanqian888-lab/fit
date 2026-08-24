import json, os

base = "/Users/yanqian/Desktop/练习项目/fit"
outfile = os.path.join(base, "design_parsed.txt")

def extract(node, depth, md, out):
    ind = "  " * depth
    nm = node.get("name", "")
    tp = node.get("type", "")
    pos = node.get("position", {})
    sty = node.get("style", {})
    txt = node.get("text", {})
    lay = node.get("layout", {})
    p = [tp]
    if nm: p.append(nm)
    if pos: p.append("x%sy%s" % (pos.get("x","?"), pos.get("y","?")))
    w = sty.get("width","")
    h = sty.get("height","")
    if w or h: p.append("%sx%s" % (w, h))
    bg = sty.get("background","")
    if bg: p.append("bg%s" % bg)
    br = sty.get("borderRadius","")
    if br: p.append("r%s" % br)
    c = sty.get("color","")
    if c: p.append("c%s" % c)
    tc = txt.get("content","")
    if tc:
        tc = tc[:50].replace("\n"," ")
        p.append('t:"%s"' % tc)
        fs = txt.get("fontSize","")
        if fs: p.append("fs%s" % fs)
        fw = txt.get("fontWeight","")
        if fw: p.append("fw%s" % fw)
        tcol = txt.get("color","")
        if tcol: p.append("tc%s" % tcol)
    disp = lay.get("display","")
    if disp: p.append(disp)
    gap = lay.get("gap","")
    if gap: p.append("gap%s" % gap)
    pad = lay.get("padding","")
    if pad: p.append("pad%s" % pad)
    out.write("%s%s\n" % (ind, "|".join(p)))
    if depth < md:
        for ch in node.get("children", []):
            extract(ch, depth+1, md, out)

with open(outfile, "w") as out:
    for fn in ["聊聊json.json", "搭搭json.json", "gongjvxiang.json"]:
        fp = os.path.join(base, "shejigao", fn)
        if not os.path.exists(fp):
            out.write("NOT FOUND: %s\n" % fn)
            continue
        out.write("\n=== %s ===\n" % fn)
        with open(fp, "r") as f:
            data = json.load(f)
        for nd in data.get("nodes", []):
            extract(nd, 0, 6, out)