# HueLoot

Extract all unique colors from any webpage with one click.

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `HueLoot` folder
5. Navigate to any `http://` or `https://` page and click the HueLoot icon

## Usage

Click the HueLoot icon on any website. A modal overlay will appear showing every unique color the browser is actively using on that page. Click any color swatch to copy its hex value to your clipboard. Click the **ⓘ** button in the header to learn how colors are extracted.

## Where do the colors come from?

Colors come from **computed styles of visible elements** — meaning what the browser has actually resolved and rendered. For each element that isn't `display:none`, `visibility:hidden`, or `opacity:0`, it reads:

- `color` (text) & `backgroundColor`
- Border colors (top / right / bottom / left)
- `outlineColor`, `textDecorationColor`, `caretColor`, `columnRuleColor`
- Colors inside `backgroundImage` gradients

You may still see colors that feel "invisible" — the filter skips `display:none`, `visibility:hidden`, and `opacity:0`, but not zero-sized elements, off-screen elements, elements covered by others, or elements clipped by `overflow:hidden`. These are technically "visible" to the browser even if you can't see them.

## Maker

For years I used some old clunky color picker tool. One day it stopped working. I could have just found another one. Instead I built HueLoot. Here you are. Enjoy.

— Marek
marek@jackoai.com
