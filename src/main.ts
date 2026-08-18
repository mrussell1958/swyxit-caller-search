import {
  ConnectionEvent,
  CreateWebExtensionClient,
  LineState,
} from '@enreachde/swyx-web-extension-sdk';
import './style.css';

const status = element<HTMLSpanElement>('status');
const statusDot = element<HTMLSpanElement>('status-dot');
const caller = element<HTMLElement>('caller');
const callerName = element<HTMLHeadingElement>('caller-name');
const callerNumber = element<HTMLParagraphElement>('caller-number');
const callDetails = element<HTMLParagraphElement>('call-details');
const searchLink = element<HTMLButtonElement>('search-link');
const empty = element<HTMLParagraphElement>('empty');
const error = element<HTMLParagraphElement>('error');

const { connection, hub, hubBack } = CreateWebExtensionClient();
const displayedCallByLine = new Map<number, number>();
let visibleCall: { lineIndex: number; callId: number } | undefined;
let googleSearchUrl = '';

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing element: ${id}`);
  return result as T;
}

function setConnectionStatus(message: string, connected: boolean): void {
  status.textContent = message;
  statusDot.classList.toggle('connected', connected);
}

function showError(message: string): void {
  error.textContent = message;
  error.classList.remove('info');
  error.hidden = false;
}

function showMessage(message: string): void {
  error.textContent = message;
  error.classList.add('info');
  error.hidden = false;
}

function clearCaller(lineIndex: number): void {
  displayedCallByLine.delete(lineIndex);

  if (visibleCall?.lineIndex !== lineIndex) return;

  visibleCall = undefined;
  googleSearchUrl = '';
  caller.hidden = true;
  empty.hidden = false;
  error.hidden = true;
  error.classList.remove('info');
}

function numberForGoogleSearch(number: string): string {
  const compactNumber = number.replace(/[\s().-]/g, '');

  if (compactNumber.startsWith('+44')) {
    return `0${compactNumber.slice(3)}`;
  }

  if (compactNumber.startsWith('0044')) {
    return `0${compactNumber.slice(4)}`;
  }

  return compactNumber;
}

async function reconcileVisibleCall(): Promise<void> {
  if (!visibleCall) return;

  const { lineIndex, callId } = visibleCall;
  const lines = await hub.GetLineDetails();
  const line = lines[lineIndex];

  if (
    !line ||
    line.callId !== callId ||
    line.lineState === LineState.Inactive ||
    line.lineState === LineState.Terminated
  ) {
    clearCaller(lineIndex);
  }
}

async function handleLineState(
  lineIndex: number,
  lineState: LineState,
): Promise<void> {
  if (
    lineState === LineState.Inactive ||
    lineState === LineState.Terminated
  ) {
    clearCaller(lineIndex);
    return;
  }

  if (lineState !== LineState.Ringing && lineState !== LineState.Knocking) {
    return;
  }

  const lines = await hub.GetLineDetails();
  const line = lines[lineIndex];

  if (!line?.isIncomingCall || !line.peerNumber) return;
  if (displayedCallByLine.get(lineIndex) === line.callId) return;

  displayedCallByLine.set(lineIndex, line.callId);
  visibleCall = { lineIndex, callId: line.callId };

  callerName.textContent = line.peerName || 'Unknown caller';
  callerNumber.textContent = line.peerNumber;
  callDetails.textContent = [
    `Line ${lineIndex + 1}`,
    line.isExternalCall ? 'External call' : 'Internal call',
    line.wasRedirected && line.redirectedFromNumber
      ? `Redirected from ${line.redirectedFromNumber}`
      : '',
  ].filter(Boolean).join(' · ');

  const searchNumber = numberForGoogleSearch(line.peerNumber);
  googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${searchNumber}"`)}`;
  searchLink.textContent = `Search Google for ${line.peerNumber}`;

  empty.hidden = true;
  error.hidden = true;
  error.classList.remove('info');
  caller.hidden = false;
}


searchLink.addEventListener('click', () => {
  if (!googleSearchUrl) return;

  // SwyxIt blocks normal pop-up windows. On Windows, the registered Edge URI
  // protocol can hand the search to the external Microsoft Edge application.
  // Copy the normal HTTPS URL first so the user still has a fallback.
  void navigator.clipboard.writeText(googleSearchUrl);
  showMessage('Opening the search in Microsoft Edge. The link has also been copied.');
  window.location.href = `microsoft-edge:${googleSearchUrl}`;
});

const callReconciliationTimer = window.setInterval(() => {
  void reconcileVisibleCall().catch((cause: unknown) => {
    console.error(cause);
  });
}, 1000);

hubBack.onConnectionStateChanged((event: ConnectionEvent) => {
  if (event === ConnectionEvent.Connected) {
    setConnectionStatus('Connected to SwyxIt', true);
  } else if (event === ConnectionEvent.Disconnected) {
    setConnectionStatus('Disconnected from SwyxIt', false);
  }
});

hubBack.onLineStateChanged((lineIndex, lineState) => {
  void handleLineState(lineIndex, lineState).catch((cause: unknown) => {
    console.error(cause);
    showError('Could not read the incoming call details.');
  });
});

connection.Connect().catch((cause: unknown) => {
  console.error(cause);
  setConnectionStatus('Unable to connect to SwyxIt', false);
  showError('Check that this page is running as a configured SwyxIt Web Extension with useSdk enabled.');
});
