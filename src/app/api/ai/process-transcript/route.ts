import { NextResponse } from 'next/server';

// Helper function to create header template with metadata
function createHeaderTemplate(
    clientName?: string,
    therapistName?: string,
    sessionDate?: string,
    duration?: number
): string {
    const lines: string[] = [];
    
    if (clientName) {
        lines.push(`**Client:** ${clientName}`);
    } else {
        lines.push(`**Client:** Unassigned`);
    }
    
    if (sessionDate) {
        try {
            const date = new Date(sessionDate);
            const formattedDate = date.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            lines.push(`**Date:** ${formattedDate}`);
        } catch (e) {
            lines.push(`**Date:** ${sessionDate}`);
        }
    } else {
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        lines.push(`**Date:** ${formattedDate}`);
    }
    
    if (therapistName) {
        lines.push(`**Therapist:** ${therapistName}`);
    } else {
        lines.push(`**Therapist:** Unknown Therapist`);
    }
    
    if (duration !== undefined && duration !== null) {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        if (minutes > 0) {
            lines.push(`**Duration:** ${minutes} minute${minutes !== 1 ? 's' : ''}${seconds > 0 ? ` ${seconds} second${seconds !== 1 ? 's' : ''}` : ''}`);
        } else {
            lines.push(`**Duration:** ${seconds} second${seconds !== 1 ? 's' : ''}`);
        }
    } else {
        lines.push(`**Duration:** Not recorded`);
    }
    
    return lines.join('\n') + '\n\n';
}

export async function POST(request: Request) {
    try {
        const { transcript, clientName, therapistName, sessionDate, duration } = await request.json();

        if (!transcript || typeof transcript !== 'string') {
            return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
        }

        // Check if OpenAI API key is configured
        const openaiApiKey = process.env.OPENAI_API_KEY;
        
        // Create header template with metadata
        const header = createHeaderTemplate(clientName, therapistName, sessionDate, duration);
        
        if (!openaiApiKey) {
            // Fallback: Use rule-based formatting if no API key
            console.warn('OPENAI_API_KEY not configured, using rule-based formatting');
            const formatted = formatTranscriptBasic(transcript);
            return NextResponse.json({ 
                structured: header + formatted,
                method: 'rule-based'
            });
        }

        // Use OpenAI to structure the transcript
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an experienced therapist assistant that analyzes therapy session transcripts and creates professional session notes with therapeutic insights.

Your task is to:
1. Analyze the client's words and identify key themes, patterns, and therapeutic insights
2. Structure the content into well-organized session notes with therapeutic interpretation
3. Identify underlying emotions, patterns, and therapeutic themes
4. Use professional therapeutic language and terminology
5. Maintain the client's voice while adding therapeutic context and insights
6. Break content into logical sections based on themes or topics discussed

IMPORTANT: 
- Do NOT add any header fields like Client, Date, Therapist, Duration - these are already added separately
- Provide therapeutic interpretation and analysis, not just formatting
- Identify patterns, themes, emotional states, and therapeutic insights
- Use professional therapeutic language appropriate for clinical documentation`
                        },
                        {
                            role: 'user',
                            content: `Analyze this therapy session transcript and create structured session notes with therapeutic interpretation. Identify key themes, patterns, emotional states, and therapeutic insights. Do NOT include any header/metadata fields (Client, Date, Therapist, Duration) - just provide the therapeutic analysis and structured notes:\n\n${transcript}`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 3000
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('OpenAI API error:', errorData);
                // Fallback to rule-based formatting
                const formatted = formatTranscriptBasic(transcript);
                return NextResponse.json({ 
                    structured: header + formatted,
                    method: 'rule-based-fallback'
                });
            }

            const data = await response.json();
            const structuredText = data.choices?.[0]?.message?.content || transcript;

            // Prepend header to structured notes
            const finalStructuredText = header + structuredText;

            return NextResponse.json({ 
                structured: finalStructuredText,
                method: 'ai'
            });

        } catch (error: any) {
            console.error('Error calling OpenAI API:', error);
            // Fallback to rule-based formatting
            const formatted = formatTranscriptBasic(transcript);
            return NextResponse.json({ 
                structured: header + formatted,
                method: 'rule-based-error'
            });
        }

    } catch (error: any) {
        console.error('Error processing transcript:', error);
        return NextResponse.json({ 
            error: `Failed to process transcript: ${error?.message || 'Unknown error'}` 
        }, { status: 500 });
    }
}

// Fallback function for rule-based formatting when AI is not available
function formatTranscriptBasic(text: string): string {
    if (!text) return text;

    let formatted = text;

    // Replace voice commands
    const replacements: [RegExp, string][] = [
        [/\s+period\s+/gi, ". "],
        [/\s+period$/gi, "."],
        [/\s+full stop\s+/gi, ". "],
        [/\s+full stop$/gi, "."],
        [/\s+comma\s+/gi, ", "],
        [/\s+comma$/gi, ","],
        [/\s+question mark\s+/gi, "? "],
        [/\s+question mark$/gi, "?"],
        [/\s+exclamation point\s+/gi, "! "],
        [/\s+exclamation point$/gi, "!"],
        [/\s+exclamation mark\s+/gi, "! "],
        [/\s+exclamation mark$/gi, "!"],
        [/\s+colon\s+/gi, ": "],
        [/\s+colon$/gi, ":"],
        [/\s+semicolon\s+/gi, "; "],
        [/\s+semicolon$/gi, ";"],
        [/\s+new line\s+/gi, "\n"],
        [/\s+new line$/gi, "\n"],
        [/\s+new paragraph\s+/gi, "\n\n"],
        [/\s+new paragraph$/gi, "\n\n"],
    ];

    replacements.forEach(([pattern, replacement]) => {
        formatted = formatted.replace(pattern, replacement);
    });

    // Split into sentences
    const sentences = formatted.split(/([.!?]+\s+)/).filter(s => s.trim());
    
    // Group sentences into paragraphs (every 3-5 sentences or on topic changes)
    let paragraphs: string[] = [];
    let currentParagraph: string[] = [];
    let sentenceCount = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;

        currentParagraph.push(sentence);
        sentenceCount++;

        // Create paragraph break every 3-5 sentences, or on certain keywords
        const shouldBreak = 
            sentenceCount >= 4 || 
            /^(so|now|then|next|also|furthermore|however|but|although|meanwhile)/i.test(sentence);

        if (shouldBreak && currentParagraph.length > 0) {
            paragraphs.push(currentParagraph.join(' '));
            currentParagraph = [];
            sentenceCount = 0;
        }
    }

    // Add remaining sentences as final paragraph
    if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
    }

    // Join paragraphs with double newlines
    formatted = paragraphs.join('\n\n');

    // Clean up whitespace
    formatted = formatted
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .join('\n');

    // Capitalize first letter of each paragraph
    formatted = formatted.replace(/(^\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());

    // Ensure proper spacing
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    return formatted.trim();
}









