## 0.0.2

- Throw an error upon schema generation if zod's `.optional()` is used but mongoose's `required` set to true or vice versa.
- Switch to using native mongoose types for number/string/boolean/date with value casting disabled to fix type specific operators not recognized by mongoose.

## 0.0.1

Initial release.