---
"@1shotapi/ows-provider": minor
---

Add create-time `presentationMode` (`flyout` | `inline`) for branding iframe chrome. Presentation is immutable — recreate the proxy to switch (no reparent/`setPresentation`; that breaks Postmate). Default visible size is 360×600.
