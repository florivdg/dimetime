/**
 * Common stubs for shadcn-vue / reka-ui components.
 * Each renders a minimal pass-through wrapper so .vue component scripts can be
 * mounted in tests without pulling in the full reka-ui dependency surface.
 */
import { h, defineComponent } from 'vue'
import { Field, Form } from 'vee-validate'

function passthrough(tag = 'div', extraProps: string[] = []) {
  return defineComponent({
    props: ['modelValue', 'open', 'asChild', ...extraProps],
    emits: ['update:modelValue', 'update:open', 'click'],
    setup(_, { slots, emit }) {
      return () =>
        h(
          tag,
          { onClick: (event: Event) => emit('click', event) },
          slots.default?.(),
        )
    },
  })
}

const button = defineComponent({
  props: ['variant', 'size', 'asChild', 'disabled', 'type'],
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () =>
      h(
        'button',
        {
          type: props.type ?? 'button',
          disabled: props.disabled,
          onClick: (e: Event) => emit('click', e),
        },
        slots.default?.(),
      )
  },
})

export const shadcnButton = { Button: button }
export const shadcnInput = {
  Input: defineComponent({
    props: ['modelValue', 'type', 'placeholder'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          type: props.type ?? 'text',
          placeholder: props.placeholder,
          value: props.modelValue,
          onInput: (e: Event) =>
            emit('update:modelValue', (e.target as HTMLInputElement).value),
        })
    },
  }),
}
export const shadcnCard = {
  Card: passthrough('section'),
  CardAction: passthrough(),
  CardContent: passthrough(),
  CardDescription: passthrough('p'),
  CardHeader: passthrough('header'),
  CardTitle: passthrough('h2'),
}
export const shadcnProgress = {
  Progress: defineComponent({
    props: ['modelValue'],
    setup: (props) => () => h('div', { 'data-progress': props.modelValue }),
  }),
}
export const shadcnForm = {
  Form,
  FormControl: passthrough(),
  FormField: Field,
  FormItem: passthrough(),
  FormLabel: passthrough('label'),
  FormMessage: passthrough('span'),
}
export const shadcnLabel = { Label: passthrough('label') }
export const shadcnCheckbox = {
  Checkbox: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
          type: 'checkbox',
          checked: props.modelValue === true,
          indeterminate: props.modelValue === 'indeterminate',
          onChange: (event: Event) =>
            emit(
              'update:modelValue',
              (event.target as HTMLInputElement).checked,
            ),
        }),
  }),
}
export const shadcnAlertDialog = {
  AlertDialog: passthrough(),
  AlertDialogAction: button,
  AlertDialogCancel: button,
  AlertDialogContent: passthrough(),
  AlertDialogDescription: passthrough('p'),
  AlertDialogFooter: passthrough(),
  AlertDialogHeader: passthrough('header'),
  AlertDialogTitle: passthrough('h3'),
  AlertDialogTrigger: passthrough(),
}
export const shadcnDialog = {
  Dialog: passthrough(),
  DialogContent: passthrough(),
  DialogScrollContent: passthrough(),
  DialogDescription: passthrough('p'),
  DialogFooter: passthrough(),
  DialogHeader: passthrough('header'),
  DialogTitle: passthrough('h3'),
  DialogTrigger: passthrough(),
}
export const shadcnDropdownMenu = {
  DropdownMenu: passthrough(),
  DropdownMenuContent: passthrough(),
  DropdownMenuItem: passthrough(),
  DropdownMenuSeparator: passthrough(),
  DropdownMenuTrigger: passthrough(),
}
export const shadcnTooltip = {
  Tooltip: passthrough(),
  TooltipContent: passthrough(),
  TooltipProvider: passthrough(),
  TooltipTrigger: passthrough(),
}
export const shadcnPinInput = {
  PinInput: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue', 'complete'],
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.())
    },
  }),
  PinInputGroup: passthrough(),
  PinInputSlot: passthrough('span'),
}
export const shadcnSelect = {
  Select: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup(_, { slots }) {
      return () => h('div', {}, slots.default?.())
    },
  }),
  SelectContent: passthrough(),
  SelectItem: passthrough(),
  SelectTrigger: passthrough(),
  SelectValue: passthrough('span'),
}
export const shadcnTable = {
  Table: passthrough('table'),
  TableBody: passthrough('tbody'),
  TableCell: passthrough('td'),
  TableHead: passthrough('th'),
  TableHeader: passthrough('thead'),
  TableRow: passthrough('tr'),
}
export const shadcnInputGroup = {
  InputGroup: passthrough(),
  InputGroupAddon: passthrough(),
  InputGroupButton: button,
  InputGroupInput: shadcnInput.Input,
}
