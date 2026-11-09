"""Independent final-PDF inspection. Run with the bundled PDF Python runtime."""
import argparse, json, re
from pathlib import Path
from pypdf import PdfReader
import pdfplumber

def norm(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--menu', type=Path, default=Path('fixtures/reviewed/week-1.menu.json'))
    parser.add_argument('--production', action='store_true')
    parser.add_argument('--packet', choices=['weekly','daily','complete'], default='weekly')
    parser.add_argument('--date')
    parser.add_argument('--include', default='')
    parser.add_argument('--report', type=Path, default=Path('output/pdf-audit.json'))
    args = parser.parse_args()
    menu = json.loads(args.menu.read_text())
    reader = PdfReader(args.pdf)
    if args.packet == 'weekly':
        expected = [('SR-01', None), ('SR-02', None)]
    elif args.packet == 'complete':
        expected = [('SR-01', None), ('SR-02', None)] + [(f'SR-{form:02}', day) for day in range(7) for form in range(3,9)]
    else:
        dates = [day['date']['value'] for day in menu['days']]
        assert args.date in dates, 'Daily audit requires a menu date'
        day = dates.index(args.date)
        extras = [] if not args.include else args.include.split(',')
        assert len(set(extras)) == len(extras) and all(extra in ['summary','prep','dessert'] for extra in extras), 'Invalid daily extras'
        forms = ([3] if 'summary' in extras else []) + ([4] if 'prep' in extras else []) + [5,6,7] + ([8] if 'dessert' in extras else [])
        expected = [(f'SR-{form:02}',day) for form in forms]
    assert len(reader.pages) == len(expected), f'Expected {len(expected)} pages, got {len(reader.pages)}'
    font_names = set()
    for page in reader.pages:
        for font_reference in page['/Resources']['/Font'].values():
            font = font_reference.get_object()
            font_names.add(str(font.get('/BaseFont', 'unknown')))
            descendants = font.get('/DescendantFonts')
            actual = descendants[0].get_object() if descendants else font
            descriptor_ref = actual.get('/FontDescriptor')
            assert descriptor_ref is not None, f'Font has no descriptor: {font}'
            descriptor = descriptor_ref.get_object()
            assert any(key in descriptor for key in ['/FontFile','/FontFile2','/FontFile3']), f'Font not embedded: {font}'
    texts = [page.extract_text() or '' for page in reader.pages]
    details = []
    for index, (page, (form, day)) in enumerate(zip(reader.pages, expected)):
        assert abs(float(page.mediabox.width)-612) < .1 and abs(float(page.mediabox.height)-792) < .1, f'Page {index+1} not Letter'
        text = texts[index]
        assert form in text, f'Page {index+1} missing {form}'
        assert len(text.strip()) > 60, f'Page {index+1} empty'
        if not args.production:
            assert 'REVIEW ONLY' in text and 'NOT FOR PRODUCTION' in text, f'Page {index+1} missing watermark'
        if day is not None:
            assert menu['days'][day]['date']['value'] in text, f'Page {index+1} incorrect date'
        details.append(dict(page=index+1, form=form, day=day, letter=True, textCharacters=len(text)))
    by_form = {key: texts[index] for index,key in enumerate(expected)}
    if ('SR-02',None) in by_form:
        assert 'total' not in by_form[('SR-02',None)].lower(), 'SR-02 must not have totals'
    checked_options = set()
    for day_index, day in enumerate(menu['days']):
        for meal_index, meal in enumerate(['breakfast','lunch','dinner']):
            for option in ['a','b']:
                data = day['meals'][meal][option]
                for key in [('SR-01',None),('SR-03',day_index),(f'SR-{meal_index+5:02}',day_index)]:
                    if key not in by_form:
                        continue
                    page_text = norm(by_form[key])
                    assert norm(data['text']['value']) in page_text, f'Missing {day_index} {meal} {option} from {key}'
                    checked_options.add((day_index,meal,option))
                    for item in data['items']:
                        assert norm(item['text']['value']) in page_text, f'Missing component from {key}: {item}'
                if ('SR-08',day_index) in by_form:
                    for item in data['items']:
                        if item['kind'] == 'dessert':
                            assert norm(item['text']['value']) in norm(by_form[('SR-08',day_index)]), f'Missing dessert {item}'
    all_font_sizes = []
    with pdfplumber.open(args.pdf) as pdf:
        for index, page in enumerate(pdf.pages):
            visible = [c for c in page.chars if c.get('text','').strip()]
            # Rotated watermark glyphs have larger bounding-box heights; inspect upright text size.
            sizes = [float(c['size']) for c in visible if c.get('upright',True)]
            assert sizes and min(sizes) >= 9.9, f'Page {index+1} has tiny text: {min(sizes)}'
            for char in visible:
                assert char['x0'] >= 28.0 and char['x1'] <= 584.0, f'Page {index+1} horizontal clipping: {char["text"]}'
                assert char['top'] >= 28.0 and char['bottom'] <= 764.0, f'Page {index+1} vertical clipping: {char["text"]}'
            all_font_sizes.extend(sizes)
    report = dict(pdf=str(args.pdf), status='PASS', packet=args.packet, pages=len(expected), allPagesUSLetter=True, embeddedFonts=sorted(font_names), sourceOptionsChecked=len(checked_options), minimumFontPt=min(all_font_sizes), productionApproval='NOT GRANTED' if not args.production else 'CHECK SEPARATE APPROVAL RECORD', physicalPrint='NOT RUN', visualReview='SEPARATE CONTACT SHEET REVIEW REQUIRED', pageDetails=details)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k != 'pageDetails'},indent=2))

if __name__ == '__main__':
    main()
