import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert, Share } from "react-native";

import { fakeApi } from "@/test-utils/api";
import { access, animal, ANIMAL_ID, animalRoutes } from "@/test-utils/fixtures";
import { renderApp, signedIn, signedOut } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

const confirmAll = () =>
  jest.spyOn(Alert, "alert").mockImplementation((_t, _m, b) => b?.find((x) => x.style === "destructive")?.onPress?.());

beforeEach(() => {
  signedIn();
  jest.restoreAllMocks();
});

const TWO_TUTORS = [
  access(),
  access({ id: 2, user_id: "u2", email: "bruna@example.com", is_me: false }),
];

describe("people", () => {
  it("lists who has access; a tutor removes someone after confirming", async () => {
    confirmAll();
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`GET /animals/${ANIMAL_ID}/accesses`]: { body: TWO_TUTORS },
      [`DELETE /animals/${ANIMAL_ID}/accesses/2`]: { status: 204 },
    });
    await renderApp(`/animais/${ANIMAL_ID}/pessoas`);
    expect(await screen.findByText("bruna@example.com")).toBeTruthy();
    expect(screen.getAllByText("Tutor")).toHaveLength(2);
    await fireEvent.press(screen.getByTestId("remove-bruna@example.com"));
    await waitFor(() => expect(api.callsTo(`DELETE /animals/${ANIMAL_ID}/accesses/2`)).toHaveLength(1));
  });

  it("the last tutor cannot leave: offers to invite a tutor or delete the animal", async () => {
    confirmAll();
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`GET /animals/${ANIMAL_ID}/accesses`]: { body: [access()] },
      [`DELETE /animals/${ANIMAL_ID}/accesses/1`]: {
        status: 409,
        body: { code: "last_tutor", detail: "the last tutor cannot leave" },
      },
      [`DELETE /animals/${ANIMAL_ID}`]: { status: 204 },
    });
    const app = await renderApp(`/animais/${ANIMAL_ID}/pessoas`);
    await fireEvent.press(await screen.findByTestId("leave"));
    expect(await screen.findByText(strings.people.lastTutorTitle)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("invite-tutor"));
    expect(app.pathname()).toBe(`/animais/${ANIMAL_ID}/convidar`);
    expect(app.params()).toMatchObject({ papel: "tutor" });
    expect(api.callsTo(`DELETE /animals/${ANIMAL_ID}`)).toHaveLength(0);
  });

  it("deleting instead asks first, then deletes the animal", async () => {
    const alert = confirmAll();
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`GET /animals/${ANIMAL_ID}/accesses`]: { body: [access()] },
      [`DELETE /animals/${ANIMAL_ID}/accesses/1`]: { status: 409, body: { code: "last_tutor", detail: "x" } },
      [`DELETE /animals/${ANIMAL_ID}`]: { status: 204 },
    });
    const app = await renderApp(`/animais/${ANIMAL_ID}/pessoas`);
    await fireEvent.press(await screen.findByTestId("leave"));
    await fireEvent.press(await screen.findByTestId("delete-instead"));
    expect(alert.mock.calls.at(-1)?.[1]).toBe(strings.animal.deleteConfirm("Lacan"));
    await waitFor(() => expect(api.callsTo(`DELETE /animals/${ANIMAL_ID}`)).toHaveLength(1));
    await waitFor(() => expect(app.pathname()).toBe("/"));
  });

  it("a guest leaves and goes home; a guest cannot remove others or invite", async () => {
    confirmAll();
    const api = fakeApi({
      ...animalRoutes(animal({ role: "guest" })),
      [`GET /animals/${ANIMAL_ID}/accesses`]: {
        body: [
          access({ is_me: false, email: "bruna@example.com" }),
          access({ id: 3, role: "guest", ends_on: "2026-12-15", is_me: true }),
        ],
      },
      [`DELETE /animals/${ANIMAL_ID}/accesses/3`]: { status: 204 },
    });
    const app = await renderApp(`/animais/${ANIMAL_ID}/pessoas`);
    expect(await screen.findByText("até 15/12/2026")).toBeTruthy();
    expect(screen.queryByTestId("remove-bruna@example.com")).toBeNull();
    expect(screen.queryByTestId("invite")).toBeNull();
    await fireEvent.press(screen.getByTestId("leave"));
    await waitFor(() => expect(api.callsTo(`DELETE /animals/${ANIMAL_ID}/accesses/3`)).toHaveLength(1));
    await waitFor(() => expect(app.pathname()).toBe("/"));
  });
});

describe("inviting", () => {
  it("creates a guest invite with an end and shares its link through the share sheet", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`POST /animals/${ANIMAL_ID}/invites`]: {
        status: 201,
        body: {
          token: "tk",
          url: "https://pets.ampulla.tech/convite/tk",
          role: "guest",
          access_ends_on: "2026-12-15",
          expires_at: "2026-11-03T00:00:00Z",
        },
      },
    });
    await renderApp(`/animais/${ANIMAL_ID}/convidar`);
    await fireEvent.changeText(await screen.findByTestId("ends-on"), "01012020");
    await fireEvent.press(screen.getByTestId("generate"));
    expect(screen.getByText(strings.people.endsOnPast)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("ends-on"), "15122026");
    await fireEvent.press(screen.getByTestId("generate"));
    expect(await screen.findByText("https://pets.ampulla.tech/convite/tk")).toBeTruthy();
    expect(api.callsTo(`POST /animals/${ANIMAL_ID}/invites`)[0].body).toEqual({
      role: "guest",
      access_ends_on: "2026-12-15",
    });
    await fireEvent.press(screen.getByTestId("share-invite"));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: "https://pets.ampulla.tech/convite/tk" }));
  });

  it("a tutor invite carries no end", async () => {
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`POST /animals/${ANIMAL_ID}/invites`]: {
        status: 201,
        body: { token: "t", url: "u", role: "tutor", access_ends_on: null, expires_at: "x" },
      },
    });
    await renderApp(`/animais/${ANIMAL_ID}/convidar?papel=tutor`);
    expect(screen.queryByTestId("ends-on")).toBeNull();
    await fireEvent.press(await screen.findByTestId("generate"));
    await waitFor(() =>
      expect(api.callsTo(`POST /animals/${ANIMAL_ID}/invites`)[0].body).toEqual({ role: "tutor", access_ends_on: null }),
    );
  });
});

const PREVIEW = {
  state: "valid",
  role: "guest",
  access_ends_on: "2026-11-30",
  invited_by: "bruna@example.com",
  animal: { name: "Mel", species: "cat", photo_url: null },
  already_member: false,
  animal_id: null,
};

describe("an invite link opened in the app", () => {
  it("shows who invited, the animal, the role and the end; accepting opens the animal", async () => {
    const api = fakeApi({
      "GET /invites/tk": { body: PREVIEW },
      "POST /invites/tk/accept": { body: { animal_id: "mel", role: "guest", ends_on: "2026-11-30" } },
      ...animalRoutes(animal({ id: "mel", name: "Mel", role: "guest" })),
    });
    const app = await renderApp("/convite/tk");
    expect(await screen.findByText(strings.invite.body("bruna@example.com", "Mel", "Convidado"))).toBeTruthy();
    expect(screen.getByText(strings.invite.endsOn("30/11/2026"))).toBeTruthy();
    await fireEvent.press(screen.getByTestId("accept"));
    await waitFor(() => expect(app.pathname()).toBe("/animais/mel"));
    expect(api.callsTo("POST /invites/tk/accept")[0].headers["x-session-token"]).toBe("token-1");
  });

  it.each([
    ["expired", strings.invite.expired],
    ["used", strings.invite.used],
  ])("says when it is %s", async (state, message) => {
    fakeApi({ "GET /invites/tk": { body: { ...PREVIEW, state } } });
    await renderApp("/convite/tk");
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByTestId("accept")).toBeNull();
  });

  it("says when the person already has access", async () => {
    fakeApi({ "GET /invites/tk": { body: { ...PREVIEW, already_member: true, animal_id: "mel" } } });
    await renderApp("/convite/tk");
    expect(await screen.findByText(strings.invite.alreadyMember)).toBeTruthy();
  });

  it("tells apart an accept the server refuses as already used", async () => {
    fakeApi({
      "GET /invites/tk": { body: PREVIEW },
      "POST /invites/tk/accept": { status: 409, body: { code: "invite_used", detail: "x" } },
    });
    await renderApp("/convite/tk");
    await fireEvent.press(await screen.findByTestId("accept"));
    expect(await screen.findByText(strings.invite.used)).toBeTruthy();
  });

  it("without an account: sign up, confirm the e-mail, then back to the invite to accept", async () => {
    signedOut();
    fakeApi({
      "GET /invites/tk": { body: PREVIEW },
      "POST /_allauth/app/v1/auth/signup": {
        status: 401,
        body: {
          status: 401,
          data: { flows: [{ id: "verify_email", is_pending: true }] },
          meta: { is_authenticated: false, session_token: "flow-n" },
        },
      },
      "POST /_allauth/app/v1/auth/email/verify": {
        body: { status: 200, data: { user: { email: "new@example.com" } }, meta: { session_token: "tok-n" } },
      },
    });
    const app = await renderApp("/convite/tk");
    expect(await screen.findByText(strings.invite.signInToAccept)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("invite-sign-up"));
    await fireEvent.changeText(await screen.findByTestId("email"), "new@example.com");
    await fireEvent.changeText(screen.getByTestId("password"), "uma-senha-longa");
    await fireEvent.press(screen.getByTestId("sign-up"));
    await fireEvent.changeText(await screen.findByTestId("verify-code"), "ab12cd34");
    await fireEvent.press(screen.getByTestId("verify"));
    await waitFor(() => expect(app.pathname()).toBe("/convite/tk"));
    expect(await screen.findByTestId("accept")).toBeTruthy();
  });
});
