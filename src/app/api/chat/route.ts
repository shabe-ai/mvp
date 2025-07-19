import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  console.log("Chat API called with messages:", messages);
  console.log("OpenAI API Key exists:", !!process.env.OPENAI_API_KEY);
  
  // Check if the last message contains "email" to trigger JSON response
  const lastMessage = messages[messages.length - 1]?.content || "";
  console.log("Last message:", lastMessage);
  console.log("Contains email:", lastMessage.toLowerCase().includes("email"));
  
  if (lastMessage.toLowerCase().includes("email")) {
    console.log("Email request detected, generating email content");
    
    // Generate actual email content based on the user's request
    const emailContent = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Generate a professional email based on the user's request. Return only the email content, not a JSON object. Start with 'Subject: [subject line]' followed by the email body."
        },
        {
          role: "user", 
          content: `Generate an email based on this request: ${lastMessage}`
        }
      ],
      stream: false,
    });
    
    const generatedEmail = emailContent.choices[0]?.message?.content || "Email content could not be generated";
    
    // Parse the subject from the generated email
    let subject = "Email";
    let body = generatedEmail;
    
    if (generatedEmail.startsWith("Subject:")) {
      const lines = generatedEmail.split('\n');
      const subjectLine = lines[0];
      subject = subjectLine.replace("Subject:", "").trim();
      body = lines.slice(2).join('\n').trim(); // Skip the subject line and empty line
    }
    
    const testResponse = {
      id: "test-response",
      object: "chat.completion",
      created: Date.now(),
      model: "gpt-3.5-turbo-1106",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify({
            action: "send_email",
            title: "Send Email",
            subject: subject,
            content: body
          })
        }
      }]
    };
    console.log("Returning generated email response:", testResponse);
    return Response.json(testResponse);
  }
  
  console.log("No email detected, proceeding with OpenAI call");
  
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    messages,
    stream: false,
  });
  return Response.json(response);
} 