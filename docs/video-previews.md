# Episode video previews

Episode pages keep their existing PNG `og:image` and optionally emit `og:video`,
`og:video:secure_url`, `og:video:type` (`video/mp4`), and available dimensions.
Twitter summary image cards remain enabled. Video playback depends on the sharing app.

Supply these optional top-level fields on the backend v2 episode records (both
the catalog and individual episode responses):

```json
{
  "previewVideoUrl": "https://media.example.com/episodes/episode-id/preview-v1.mp4",
  "previewVideoWidth": 1280,
  "previewVideoHeight": 720
}
```

The URL must point directly to a public HTTPS MP4, without credentials, login,
or an expiring signature. Serve it as `video/mp4`. Dimensions are optional positive
integer pixel counts; use the actual encoded dimensions. Missing or invalid URLs
leave the episode's image preview intact. Invalid dimensions are omitted.

Produce and upload the clip before publishing its URL. This website does not
generate or upload videos. Prefer a short H.264 MP4 with fast-start encoding and,
if it includes audio, AAC. Use a versioned URL when replacing the clip because
sharing apps cache previews.

To verify after deployment:

1. Fetch the episode page as a crawler and check its `og:video` and `og:image` tags.
2. Fetch the video URL without authentication; verify a successful MP4 response
   and playback on the target device.
3. Share the canonical episode URL in Apple Messages and check the video preview.
4. Share an episode without a video and confirm the existing image preview.

Apple documents direct video previews in
[Messages](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages).
Other platforms may display only the fallback image. X player cards would require
a separate player integration.
