// Replace this scaffold with the accepted generated leaves in reading order.
// Files resolve relative to assets/pages/. pageWidth/pageHeight are leaf pixels.
window.PHOTOBOOK = {
  id: "photobook",
  title: "Photobook",
  pageWidth: 768,
  pageHeight: 1024,
  frontCover: { file: "cover-right.png", alt: "Describe the front cover." },
  spreads: [
    {
      id: "s01",
      left: { file: "s01-left.png", alt: "Describe the left page." },
      right: { file: "s01-right.png", alt: "Describe the right page." }
    }
  ],
  backCover: { file: "cover-left.png", alt: "Describe the back cover." }
};
