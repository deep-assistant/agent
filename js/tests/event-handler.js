import { describe, expect, test } from 'bun:test';
import { createBusEventSubscription } from '../src/cli/event-handler.js';
import { Bus } from '../src/bus/index.ts';
import { Instance } from '../src/project/instance.ts';
import { SessionStatus } from '../src/session/status.ts';

describe('createBusEventSubscription', () => {
  test('outputs a public idle event when the session reaches a turn boundary', async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const outputs = [];
        const { unsub, idlePromise } = createBusEventSubscription({
          sessionID: 'ses_idle',
          eventHandler: {
            output(event) {
              outputs.push(event);
            },
          },
          onError() {},
        });

        try {
          await Bus.publish(SessionStatus.Event.Idle, {
            sessionID: 'ses_idle',
          });
          await idlePromise;
        } finally {
          unsub();
        }

        expect(outputs).toContainEqual(
          expect.objectContaining({
            type: 'session_idle',
            sessionID: 'ses_idle',
          })
        );
      },
    });
  });
});
