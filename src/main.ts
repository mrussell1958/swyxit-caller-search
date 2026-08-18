import {
  ConnectionEvent,
  ConnectionReason,
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
const searchLink = element<HTMLAnchorElement>('search-link');
const empty = element<HTMLParagraphElement>('empty');
const error = element<HTMLParagraphElement>('error');

const { connection, hub, hubBack } = CreateWebExtensionClient();
const displayedCallByLine = new Map<number, number>();

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
  error.hidden = false;
}

async function handleLineState(
  lineIndex: number,
  lineState: LineState,
): Promise<void> {
  if (lineState === LineState.Inactive) {
    displayedCallByLine.delete(lineIndex);
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

  callerName.textContent = line.peerName || 'Unknown caller';
  callerNumber.textContent = line.peerNumber;
  callDetails.textContent = [
    `Line ${lineIndex + 1}`,
    line.isExternalCall ? 'External call' : 'Internal call',
    line.wasRedirected && line.redirectedFromNumber
      ? `Redirected from ${line.redirectedFromNumber}`
      : '',
  ].filter(Boolean).join(' · ');

  searchLink.href = `https://www.google.com/search?q=${encodeURIComponent(`"${line.peerNumber}"`)}`;
  searchLink.textContent = `Search Google for ${line.peerNumber}`;

  empty.hidden = true;
  error.hidden = true;
  caller.hidden = false;
}

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

window.addEventListener('beforeunload', () => {
  void connection.Disconnect(ConnectionReason.Shuttingdown, true);
});

connection.Connect().catch((cause: unknown) => {
  console.error(cause);
  setConnectionStatus('Unable to connect to SwyxIt', false);
  showError('Check that this page is running as a configured SwyxIt Web Extension with useSdk enabled.');
});
