import React from 'react';
import '../styles/quicknote-enhanced.css';

interface NoteFormatterProps {
  content: string;
}

export default function NoteFormatter({ content }: NoteFormatterProps) {
  /**
   * Remove duplicate sections from AI-generated notes
   * Common issue: MEDICATIONS section appears twice
   */
  const removeDuplicateSections = (text: string): string => {
    const sections: Map<string, string> = new Map();
    const lines = text.split('\n');
    let currentHeader = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if this is a section header
      if (trimmed.match(/^[A-Z][A-Z\s,:&/]+:$/)) {
        // Save previous section if exists
        if (currentHeader && currentContent.length > 0) {
          const content = currentContent.join('\n');
          // Only keep first occurrence of each section
          if (!sections.has(currentHeader)) {
            sections.set(currentHeader, content);
          }
        }

        // Start new section
        currentHeader = trimmed;
        currentContent = [];
      } else if (currentHeader) {
        currentContent.push(line);
      } else {
        // Content before first header - keep as is
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentHeader && currentContent.length > 0) {
      const content = currentContent.join('\n');
      if (!sections.has(currentHeader)) {
        sections.set(currentHeader, content);
      }
    }

    // Rebuild text without duplicates
    let result = '';
    if (currentContent.length > 0 && !currentHeader) {
      // Add content before first header
      result = currentContent.join('\n') + '\n\n';
    }

    for (const [header, content] of sections) {
      result += `${header}\n${content}\n\n`;
    }

    return result.trim();
  };

  const formatNote = (text: string) => {
    // STEP 1: Remove duplicate sections (common AI output issue)
    const cleanedText = removeDuplicateSections(text);

    // Split content into sections
    const lines = cleanedText.split('\n');
    const formattedSections: JSX.Element[] = [];
    let currentSection: string[] = [];
    let sectionKey = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this is a main section header (starts with ###)
      if (line.startsWith('###')) {
        // Process previous section if exists
        if (currentSection.length > 0) {
          formattedSections.push(
            <div key={`section-${sectionKey}`} className="mb-4">
              {formatSection(currentSection.join('\n'))}
            </div>
          );
          sectionKey++;
          currentSection = [];
        }

        // Add the header with special formatting
        const headerText = line.replace(/^###\s*/, '');
        formattedSections.push(
          <h3
            key={`header-${sectionKey}`}
            className="qn-note-section-header"
          >
            <span className="mr-2">{getSectionIcon(headerText)}</span>
            {headerText}
          </h3>
        );
        sectionKey++;
      } else {
        currentSection.push(line);
      }
    }

    // Process last section
    if (currentSection.length > 0) {
      formattedSections.push(
        <div key={`section-${sectionKey}`} className="mb-4">
          {formatSection(currentSection.join('\n'))}
        </div>
      );
    }

    return formattedSections;
  };

  const formatSection = (text: string): JSX.Element[] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map((line, index) => {
      const trimmedLine = line.trim();

      // Assessment / Plan special formatting
      if (trimmedLine.match(/^Assessment\s*\/\s*Plan$/i)) {
        return (
          <h4 key={index} className="font-bold text-gray-900 mt-3 mb-2 text-base">
            {trimmedLine}
          </h4>
        );
      }

      // Condition headers (e.g., "T1DM:", "HTN:", etc.)
      if (trimmedLine.match(/^[A-Z0-9]+:/) && trimmedLine.length < 30) {
        const [condition, ...rest] = trimmedLine.split(':');
        return (
          <div key={index} className="mb-2">
            <span className="font-bold text-purple-700 mr-2">{condition}:</span>
            <span className="text-gray-700">{rest.join(':').trim()}</span>
          </div>
        );
      }

      // ICD-10 codes
      if (trimmedLine.match(/^[A-Z]\d{2}\.?\d*/)) {
        const [code, ...description] = trimmedLine.split(':');
        return (
          <div key={index} className="ml-4 mb-2 flex items-start gap-2">
            <span className="qn-icd-code">
              {code.trim()}
            </span>
            <span className="text-gray-700 flex-1">{description.join(':').trim()}</span>
          </div>
        );
      }

      // Numbered items
      if (trimmedLine.match(/^\d+\./)) {
        return (
          <div key={index} className="ml-4 mb-2 flex">
            <span className="text-blue-600 font-semibold mr-2">
              {trimmedLine.match(/^\d+\./)![0]}
            </span>
            <span className="text-gray-700 flex-1">{trimmedLine.replace(/^\d+\.\s*/, '')}</span>
          </div>
        );
      }

      // Bullet points
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
        return (
          <div key={index} className="ml-4 mb-1 flex">
            <span className="text-green-600 mr-2">•</span>
            <span className="text-gray-700 flex-1">{trimmedLine.replace(/^[•-]\s*/, '')}</span>
          </div>
        );
      }

      // Lab values and vitals (contains numbers with units)
      if (trimmedLine.match(/\d+\s*(mg|ml|units|mcg|%|mmHg)/i)) {
        return (
          <div key={index} className="ml-4 mb-1">
            <span className="text-gray-700">{highlightValues(trimmedLine)}</span>
          </div>
        );
      }

      // Medications (contains mg, units, etc.)
      if (trimmedLine.match(/(mg|mcg|units?|tablet|capsule|injection|daily|twice|three times)/i)) {
        return (
          <div key={index} className="ml-4 mb-2 bg-blue-50 border-l-4 border-blue-400 p-2">
            <span className="text-gray-800">{highlightMedication(trimmedLine)}</span>
          </div>
        );
      }

      // A1C values
      if (trimmedLine.match(/A1[Cc].*:\s*\d/)) {
        return (
          <div key={index} className="ml-4 mb-1">
            <span className="font-semibold text-orange-600">A1C: </span>
            <span className="text-gray-700">{trimmedLine.replace(/A1[Cc].*?:\s*/, '')}</span>
          </div>
        );
      }

      // Return to Office
      if (
        trimmedLine.toLowerCase().includes('return') &&
        trimmedLine.toLowerCase().includes('office')
      ) {
        return (
          <div key={index} className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <span className="text-gray-800 font-medium">📅 {trimmedLine}</span>
          </div>
        );
      }

      // Default paragraph
      return (
        <p key={index} className="text-gray-700 mb-2 leading-relaxed">
          {trimmedLine}
        </p>
      );
    });
  };

  const highlightValues = (text: string): JSX.Element => {
    const parts = text.split(/(\d+\.?\d*\s*(?:mg|ml|units|mcg|%|mmHg))/gi);
    return (
      <>
        {parts.map((part, i) => {
          if (part.match(/\d+\.?\d*\s*(?:mg|ml|units|mcg|%|mmHg)/i)) {
            return (
              <span key={i} className="font-semibold text-indigo-600 bg-indigo-50 px-1 rounded">
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  };

  const highlightMedication = (text: string): JSX.Element => {
    // Highlight medication names (usually at the beginning)
    const parts = text.split(/^([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*/);
    if (parts.length > 1) {
      return (
        <>
          <span className="font-bold text-blue-700">{parts[1]}</span>
          <span>{highlightValues(parts.slice(2).join(''))}</span>
        </>
      );
    }
    return <>{highlightValues(text)}</>;
  };

  const getSectionIcon = (headerText: string): string => {
    const lowerHeader = headerText.toLowerCase();

    if (lowerHeader.includes('presenting')) return '🏥';
    if (lowerHeader.includes('diabetes') || lowerHeader.includes('t1d')) return '🩺';
    if (lowerHeader.includes('hypertension') || lowerHeader.includes('htn')) return '❤️';
    if (lowerHeader.includes('mental') || lowerHeader.includes('depression')) return '🧠';
    if (lowerHeader.includes('vitamin')) return '💊';
    if (lowerHeader.includes('lipid') || lowerHeader.includes('cholesterol')) return '🫀';
    if (lowerHeader.includes('assessment') || lowerHeader.includes('plan')) return '📋';
    if (lowerHeader.includes('pump') || lowerHeader.includes('insulin')) return '💉';
    if (lowerHeader.includes('monitoring')) return '📊';
    if (lowerHeader.includes('management')) return '⚕️';
    if (lowerHeader.includes('problem list') || lowerHeader.includes('icd')) return '📝';
    if (lowerHeader.includes('laboratory') || lowerHeader.includes('lab')) return '🧪';
    if (lowerHeader.includes('prescription')) return '💊';
    if (lowerHeader.includes('return') || lowerHeader.includes('follow')) return '📅';

    return '📌';
  };

  return (
    <div className="prose prose-sm max-w-none">
      <div className="bg-white rounded-lg p-6">{formatNote(content)}</div>
    </div>
  );
}
