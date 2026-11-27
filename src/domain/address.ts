export type Speaker = {
  id: number;
  name: string;
  partnerName: string;
};

export function speakerFor(input: {
  userId: number;
  firstName?: string;
  lucasUserId: number | null;
  giUserId: number | null;
  lucasName: string;
  giName: string;
}): Speaker {
  const first = input.firstName?.trim();
  if (input.giUserId !== null && input.userId === input.giUserId) {
    return { id: input.userId, name: first || input.giName, partnerName: input.lucasName };
  }
  if (input.lucasUserId !== null && input.userId === input.lucasUserId) {
    return { id: input.userId, name: first || input.lucasName, partnerName: input.giName };
  }
  return {
    id: input.userId,
    name: first || "você",
    partnerName: input.giName,
  };
}

export function addressedToBot(input: {
  chatType: string;
  text: string;
  replyToBot: boolean;
  mentionsBot: boolean;
}): boolean {
  if (input.chatType === "private") return true;
  if (input.chatType !== "group" && input.chatType !== "supergroup") return false;
  if (input.replyToBot || input.mentionsBot) return true;
  if (/^\+\s*\d/.test(input.text.trim())) return true;
  return input.text.trim().startsWith("/");
}
