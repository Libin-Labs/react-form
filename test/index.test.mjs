import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { setup, input } from './helpers.mjs';
import { useForm, useFieldArray } from '../dist/index.js';
let ui, api, array;
beforeEach(async () => (ui = await setup()));
afterEach(async () => ui.cleanup());
test('validation gates submission, tracks dirty/touched and bounds field arrays', async () => {
  let submitted = 0;
  function App() {
    api = useForm({
      defaultValues: { name: '', tasks: [] },
      maxArrayItems: 2,
      validators: { name: (value) => (value ? '' : 'Required') },
    });
    array = useFieldArray(api, 'tasks');
    return createElement('input', api.register('name'));
  }
  await ui.render(createElement(App));
  await act(async () => assert.equal(await api.handleSubmit(() => submitted++)(), false));
  assert.equal(api.errors.name, 'Required');
  await input(ui.container.querySelector('input'), 'Ada');
  assert.equal(api.isDirty, true);
  await act(async () => api.handleSubmit(() => submitted++)());
  assert.equal(submitted, 1);
  await act(() => array.append({ id: 1 }));
  await act(() => array.append({ id: 2 }));
  assert.throws(() => array.append({ id: 3 }), /limit/);
  await act(() => api.reset());
  assert.equal(api.isDirty, false);
});
test('changing a value during validation never submits unvalidated replacement values', async () => {
  let release,
    submission,
    submitted = 0;
  function App() {
    api = useForm({
      defaultValues: { name: 'original' },
      validate: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    return null;
  }
  await ui.render(createElement(App));
  await act(() => {
    submission = api.handleSubmit(() => submitted++)();
  });
  await act(() => api.setValue('name', 'changed'));
  await act(async () => {
    release({});
    await submission;
  });
  assert.equal(submitted, 0);
});
