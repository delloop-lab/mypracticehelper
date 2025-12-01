import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { transcript } = await request.json();

        if (!transcript || typeof transcript !== 'string') {
            return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
        }

        // Check if OpenAI API key is configured
        const openaiApiKey = process.env.OPENAI_API_KEY;
        
        if (!openaiApiKey) {
            // Fallback: Use rule-based formatting if no API key
            console.warn('OPENAI_API_KEY not configured, using rule-based formatting');
            return NextResponse.json({ 
                structured: formatTranscriptBasic(transcript),
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
                            content: `You are a helpful assistant that formats therapy session transcripts into well-structured session notes. 
                            Format the transcript with proper paragraphs, correct punctuation, and clear structure. 
                            Break the text into logical paragraphs based on topic changes or natural pauses.
                            Preserve all important information and maintain a professional tone suitable for therapy session documentation.
                            Do not add information that wasn't in the original transcript.`
                        },
                        {
                            role: 'user',
                            content: `Please format this therapy session transcript into well-structured session notes with proper paragraphs:\n\n${transcript}`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('OpenAI API error:', errorData);
                // Fallback to rule-based formatting
                return NextResponse.json({ 
                    structured: formatTranscriptBasic(transcript),
                    method: 'rule-based-fallback'
                });
            }

            const data = await response.json();
            const structuredText = data.choices?.[0]?.message?.content || transcript;

            return NextResponse.json({ 
                structured: structuredText,
                method: 'ai'
            });

        } catch (error: any) {
            console.error('Error calling OpenAI API:', error);
            // Fallback to rule-based formatting
            return NextResponse.json({ 
                structured: formatTranscriptBasic(transcript),
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







