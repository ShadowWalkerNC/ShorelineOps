import React, { useState } from 'react';

const DOCS = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    file: 'PRIVACY.md',
    icon: '🔒',
    description: 'How we collect, use, and protect staff and resident data across all U.S. states.',
  },
  {
    id: 'terms',
    title: 'Terms of Use',
    file: 'TERMS.md',
    icon: '📋',
    description: 'Rules governing authorized access and use of the Shoreline platform.',
  },
  {
    id: 'aup',
    title: 'Acceptable Use Policy',
    file: 'AUP.md',
    icon: '✅',
    description: 'Standards for responsible, ethical, and lawful platform use by staff.',
  },
  {
    id: 'hipaa',
    title: 'HIPAA Notice of Privacy Practices',
    file: 'HIPAA_NOTICE.md',
    icon: '🏥',
    description: 'How Protected Health Information (PHI) may be used and disclosed.',
  },
  {
    id: 'baa',
    title: 'Business Associate Agreement',
    file: 'BAA.md',
    icon: '🤝',
    description: 'Template BAA for vendors who process PHI on behalf of Shoreline Operations LLC.',
  },
];

export default function Legal() {
  const [active, setActive] = useState<string | null>(null);

  const activeDoc = DOCS.find((d) => d.id === active);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Legal & Compliance
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Shoreline Operations LLC — Effective July 8, 2026
        </p>
      </div>

      {!active ? (
        <div className="grid gap-4">
          {DOCS.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setActive(doc.id)}
              className="flex items-start gap-4 p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-left hover:border-teal-500 dark:hover:border-teal-400 hover:shadow-md transition-all"
            >
              <span className="text-2xl mt-0.5">{doc.icon}</span>
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {doc.title}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {doc.description}
                </div>
              </div>
              <span className="ml-auto text-gray-400 dark:text-gray-500 self-center text-lg">›</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setActive(null)}
            className="flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:underline mb-6"
          >
            ‹ Back to Legal Documents
          </button>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <span className="text-2xl">{activeDoc?.icon}</span>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {activeDoc?.title}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Shoreline Operations LLC · Effective July 8, 2026
                </p>
              </div>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                View the full document in the repository: <code>{activeDoc?.file}</code>
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                All legal documents are maintained in the project repository root. Contact the
                Privacy Officer at{' '}
                <span className="font-mono text-teal-700 dark:text-teal-400">
                  [LEGAL_CONTACT_EMAIL_PLACEHOLDER]
                </span>{' '}
                with any questions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
