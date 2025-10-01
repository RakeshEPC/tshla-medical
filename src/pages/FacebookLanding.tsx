import React, { useEffect, useState } from 'react';
import EarlyAccessForm from '../components/EarlyAccessForm';

// Configure these links
const YOUTUBE_VIDEO_ID = 'hAVKztnxm6g'; // TSHLA Medical video

const FacebookLanding: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  useEffect(() => {
    // Set page title and meta tags
    document.title = 'PumpDrive: The Right Choice, Made Simple. | TSHLA.ai';

    // Add meta tags for social sharing
    const metaTags = [
      { property: 'og:title', content: 'PumpDrive: The Right Choice, Made Simple.' },
      {
        property: 'og:description',
        content:
          "We're looking for early adopters — patients and doctors who want to help shape this movement.",
      },
      { property: 'og:url', content: 'https://tshla.ai/facebook' },
      { property: 'og:site_name', content: 'TSHLA.ai' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'PumpDrive: The Right Choice, Made Simple.' },
      {
        name: 'twitter:description',
        content: 'Join early access — help bring trust back to diabetes care.',
      },
      {
        name: 'description',
        content:
          'A simple, unbiased way to choose an insulin pump. Patients get clarity. Doctors get time. Apply for early access.',
      },
    ];

    metaTags.forEach(tag => {
      const meta = document.createElement('meta');
      if (tag.property) {
        meta.setAttribute('property', tag.property);
      } else {
        meta.setAttribute('name', tag.name);
      }
      meta.content = tag.content;
      document.head.appendChild(meta);
    });

    // Cleanup on unmount
    return () => {
      metaTags.forEach(tag => {
        const selector = tag.property
          ? `meta[property="${tag.property}"]`
          : `meta[name="${tag.name}"]`;
        const element = document.querySelector(selector);
        if (element) {
          element.remove();
        }
      });
    };
  }, []);

  const scrollToVideo = () => {
    document.getElementById('video')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="text-blue-700">Transforming Healthcare with AI</span>
          </h1>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto rounded-xl bg-orange-500 px-6 py-3 text-base font-semibold text-white shadow hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 transition-colors text-center"
            >
              Apply for Early Access
            </button>
            <button
              onClick={scrollToVideo}
              className="w-full sm:w-auto rounded-xl border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              Watch 3-min Story
            </button>
          </div>
        </div>
      </section>

      {/* Video Section - Moved to top */}
      <section id="video" className="px-6 pb-10 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-center text-sm font-medium uppercase tracking-wider text-slate-500">
            Why we're building the future of diabetes care (3 min)
          </p>
          <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-lg bg-slate-100">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0`}
              title="TSHLA Medical — Why we're building it"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* Three Products Section */}
      <section className="px-6 py-16 lg:px-8 bg-gray-50">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Our Three Game-Changing Solutions
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* PumpDrive */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border-t-4 border-blue-500">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">PumpDrive</h3>
              <p className="text-slate-600 mb-4">
                The insulin pump selection tool that brings clarity to confusion. Help patients find
                their perfect pump match in minutes, not months.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>23-dimension pump comparison</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Unbiased recommendations</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Doctor-approved reports</span>
                </li>
              </ul>
            </div>

            {/* Dictation/Scribe */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border-t-4 border-green-500">
              <div className="text-4xl mb-4">🎙️</div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Dictation/Scribe</h3>
              <p className="text-slate-600 mb-4">
                Ambient AI medical scribe that captures doctor-patient conversations and creates
                perfect documentation automatically.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Real-time transcription</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>SOAP note generation</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>100% HIPAA compliant</span>
                </li>
              </ul>
            </div>

            {/* Diabetes Education/Thrive */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border-t-4 border-purple-500">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Thrive Education</h3>
              <p className="text-slate-600 mb-4">
                Personalized diabetes education that empowers patients with clear, actionable
                guidance tailored to their journey.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Interactive learning modules</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Progress tracking</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>AI-powered Q&A support</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Invitation Section */}
      <section className="px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-lg leading-7 text-slate-700">
            We're inviting a small group of patients and doctors to help shape these revolutionary
            tools. You'll get early access to all three platforms, direct input into development,
            and recognition as part of the founding group.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-base font-semibold text-white shadow hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 transition-colors"
            >
              Join Early Access
            </button>
          </div>
        </div>
      </section>

      {/* Why These Three Section */}
      <section className="px-6 py-12 lg:px-8 bg-blue-50">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">
            Why These Three Tools Together?
          </h2>
          <div className="prose prose-lg mx-auto text-slate-700">
            <p className="text-center">
              <strong>Diabetes care is broken.</strong> Patients are overwhelmed by pump choices.
              Doctors spend more time typing than treating. Education is generic and outdated.
            </p>
            <p className="text-center mt-4">
              Our integrated suite solves all three problems: <strong>PumpDrive</strong> brings
              clarity to device selection,
              <strong>Dictation/Scribe</strong> gives doctors their time back, and{' '}
              <strong>Thrive</strong> empowers patients with personalized education. Together, they
              create a complete ecosystem for modern diabetes care.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-6 py-12 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          <BenefitCard
            title="For Patients"
            points={[
              'Find the perfect insulin pump match with PumpDrive',
              'Get personalized diabetes education with Thrive',
              'Access your medical records anytime, anywhere',
            ]}
          />
          <BenefitCard
            title="For Doctors"
            points={[
              'Save 2+ hours daily with AI medical scribe',
              'Standardized pump recommendations for patients',
              'HIPAA-compliant documentation in seconds',
            ]}
          />
          <BenefitCard
            title="For Healthcare"
            points={[
              'Reduce medical errors with AI assistance',
              'Improve patient outcomes with better tools',
              'Build trust through transparency and clarity',
            ]}
          />
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 pb-24 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-blue-50 p-8 text-center shadow-lg">
          <h2 className="text-2xl font-bold text-slate-900">Join the movement.</h2>
          <p className="mt-3 text-slate-700">
            Help us bring clarity back to diabetes care. Apply now — we'll only share the app with
            early access members first.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-base font-semibold text-white shadow hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 transition-colors"
            >
              Apply for Early Access
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            No spam. No hype. Just a small founding group shaping something real.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-6 py-6 text-center text-sm text-slate-500 lg:px-8">
        <p>© {new Date().getFullYear()} TSHLA.ai • PumpDrive</p>
        <p className="mt-1">
          Built with care. Questions?{' '}
          <a
            href="mailto:hello@tshla.ai"
            className="underline hover:text-slate-700 transition-colors"
          >
            hello@tshla.ai
          </a>
        </p>
      </footer>

      {/* Early Access Form Modal */}
      {showForm && <EarlyAccessForm onClose={() => setShowForm(false)} />}
    </main>
  );
};

const BenefitCard: React.FC<{ title: string; points: string[] }> = ({ title, points }) => {
  return (
    <div className="rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2 text-slate-700">
        {points.map((point, index) => (
          <li key={index} className="leading-6">
            • {point}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FacebookLanding;
