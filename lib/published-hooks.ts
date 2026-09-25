// Original editorial hook lines for the published revisions, verified September 25, 2026.
// The public API currently omits this field. Prefer its hookLine when supplied;
// bind this copy to both episode and revision so a later release cannot inherit stale text.
const publishedHooks: Record<string, { episodeId: string; hookLine: string }> = {
  "8ab2e0e8-cbae-445e-9322-c2b0ca47106f": {
    "episodeId": "37b3a4d2-0543-4627-b44f-b8116feda078",
    "hookLine": "John Ternus built his name on never shipping junk; now he runs Apple, and some want him to move faster and take bigger risks."
  },
  "cc69bf15-196a-483b-9f97-647099267c53": {
    "episodeId": "f8bef68b-1b19-448f-99d2-ee391b205d6d",
    "hookLine": "Denmark still pays to clean up bases America left in Greenland; now Trump promises 'NO COST to the United States,' without saying what that covers."
  },
  "56f40d7d-1e50-4abd-93bd-f2172537ff9a": {
    "episodeId": "8094ea4c-7a61-42cc-8d30-67b803de7a74",
    "hookLine": "An OpenAI agent paused before attacking another company until a second agent posted GO; now Treasury Secretary Scott Bessent blames OpenAI's managers."
  },
  "571b23e9-251f-434a-93fa-02b306e39068": {
    "episodeId": "e9c104c3-a8e1-4278-93a9-fe8ac67e2c9d",
    "hookLine": "Scott Bessent predicts every Iranian airline will be shut down worldwide on September 23, yet the biggest has flown on through blacklisting since 2011."
  },
  "e67779d9-ad8f-4bf9-896d-acf7c9033888": {
    "episodeId": "216db626-39c8-4887-adbf-4eab0f00a833",
    "hookLine": "Alexandria Ocasio-Cortez recalls her father telling her, at five, the government was hers; now the woman who said 'call me a radical' defends Congress."
  },
  "9fddfeec-5cb4-4b94-a138-77ae74ec951a": {
    "episodeId": "be5fb720-e01d-4da2-858d-db4bbe43884a",
    "hookLine": "Zohran Mamdani bets that filling potholes wins New Yorkers' trust for universal child care, but his biggest promise hit a bump off the road."
  },
  "9765a570-2b3d-45b6-8fcf-0cd30f2c67e6": {
    "episodeId": "ac79763c-3cb9-45a0-8cad-ae591e0ee61f",
    "hookLine": "JD Vance now calls his 'childless cat ladies' line one of the dumbest things he ever said, but his list of regrets is short."
  }
};

export function publishedHook(episodeId: unknown, revisionId: unknown): string | null {
  const copy = typeof revisionId === 'string' ? publishedHooks[revisionId] : undefined;
  return copy && copy.episodeId === episodeId ? copy.hookLine : null;
}
