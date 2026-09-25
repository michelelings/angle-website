import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata('/about', 'About Angle | Audio Stories and News Explainers',
  'Learn about Angle audio stories, transcripts, source information, and how to share feedback.');
export default function About() {
  return <main><Header /><article className="about-page">
    <h1>About Angle</h1>
    <p>Angle brings together audio stories about technology and world events. You can listen on the web, read episode transcripts, and explore the sources published with a story.</p>
    <h2>Reading alongside listening</h2>
    <p>Each episode has a summary and publication date. Where available, the story also includes source links, transcript chapters, presenter information, and the date through which its reporting applies. A publication date does not mean every event discussed happened on that date.</p>
    <h2>Presenters and sources</h2>
    <p>Presenter disclosures appear with the episodes. Synthetic or fictional presenters are not evidence of firsthand reporting or subject expertise. Follow the source links to explore the material behind a story and its qualifications.</p>
    <h2>Feedback and corrections</h2>
    <p>To flag a possible error, contact <a href="https://x.com/angle_newsapp" rel="noopener noreferrer">Angle on X</a> or <a href="https://www.instagram.com/angle_newsapp" rel="noopener noreferrer">Instagram</a>. Include the episode link, the passage or timestamp, and a supporting source so the issue is clear.</p>
  </article><SiteFooter /></main>;
}
