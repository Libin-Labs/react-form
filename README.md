# @lp-labs/react-form

Typed flat-field form state, validation, async submission and bounded field arrays. React 18+ peer only; no runtime validation framework. ESM, CommonJS and generated declarations included.

## Installation

```sh
npm install @lp-labs/react-form
```

## Quick Start

```jsx
import { useForm } from '@lp-labs/react-form';
export default function Example() {
  const form = useForm({
    defaultValues: { name: '' },
    validators: { name: (value) => (String(value).trim() ? undefined : 'Required') },
  });
  return (
    <form
      onSubmit={form.handleSubmit(async (values, { signal }) => {
        signal.throwIfAborted();
        console.log(values.name);
      })}
    >
      <label>
        Name
        <input {...form.register('name')} />
      </label>
      {form.errors.name && <p role="alert">{form.errors.name}</p>}
      <button disabled={form.isSubmitting}>Submit</button>
      {form.submitError && <p role="alert">{form.submitError.message}</p>}
    </form>
  );
}
```

## API

`useForm({defaultValues,validators,validate,validateOn='submit',maxFields=100,maxArrayItems=1000})` returns values/errors/touched, dirtyFields/isDirty, isValidating/isSubmitting/submitError, register(name), setValue(name,value), validate(), handleSubmit(callback), reset(values?). Field validators return a string or undefined; whole-form validate(values,signal) returns an error map. Both may be async. Register supplies text/checkbox value, change/blur handlers and aria-invalid. Numeric conversion and error IDs/labels are application responsibilities. Validation modes are submit, blur and change. Submitted callbacks receive an AbortSignal; unmount/reset cancels work and late validation does not overwrite newer validation.

`useFieldArray(form,name)` returns fields, append, remove(index), move(from,to), replace(array). Use stable application IDs as React keys. Fields are flat identifiers, not dot/bracket paths; partial nested-object updates and automatic nested error mapping are not supported. Dirty tracking uses reference equality; keep objects and arrays immutable.

## Benefits

| Area                  | Details                                                  |
| --------------------- | -------------------------------------------------------- |
| Bounded form state    | Field and array limits are explicit.                     |
| Async-safe validation | Validation and submit work receive cancellation signals. |
| Framework-free rules  | Use custom field validators without a schema runtime.    |

## Customization

| Area              | Details                                             |
| ----------------- | --------------------------------------------------- |
| Validation        | Combine field validators and whole-form validation. |
| Validation timing | Choose submit, blur, or change validation.          |
| Array fields      | Set per-form item limits and update rows immutably. |

## Security And Limits

Fields: 1–1,000; arrays: 1–10,000, text values at most 1 MiB code units, field names at most 128 safe identifier characters, error strings at most 1,024 characters. Prototype-related names are rejected. Do not retain secrets in form defaults or logs; remove the example console callback for sensitive forms. Client validation never replaces server-side validation, authorization, CSRF controls or request limits. Async callbacks must honor cancellation; synchronous validators cannot be interrupted. Native browser submit and application labels remain your responsibility. No schema library, file handling, persistence or network transport is bundled.

## Support

[Donate via PayPal](https://www.paypal.me/LibinPrasanth). Author: [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/).

## License

MIT License. See the packaged [LICENSE](LICENSE) file.
