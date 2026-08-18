# SwyxIt Caller Search

A static SwyxIt Web Extension that detects incoming calls on any line and offers a Google search for the calling-party number. No application backend or API key is required.

## Local development

```bash
npm install
npm run dev
```

The SDK connection only works when the page is loaded by SwyxIt as a Web Extension.

## Swyx configuration

After GitHub Pages is deployed, use its HTTPS address in `configuration.json`:

```json
{
  "url": "https://YOUR-GITHUB-USERNAME.github.io/swyxit-caller-search/",
  "title": "Caller Search",
  "titleShort": "Caller Search",
  "useSdk": true,
  "displayTypes": ["widget"],
  "widgetHeight": 360
}
```

Upload the completed configuration through Swyx Control Center.
