import { RiotComponentWrapper, WithTypes } from '../../riot'
import { withTypes } from '../../riot'
import ConditionalSlot from './conditional-slot.riot'

export type ConditionalSlotProps = {}

export type ConditionalSlotState = {
  mustShowSlot: boolean
}

const exports = () =>
  (withTypes as WithTypes<ConditionalSlotProps>)({
    state: {
      mustShowSlot: false,
    } as ConditionalSlotState,

    components: {
      ConditionalSlot,
    },
  })

export default {
  css: null,

  exports,
  template: function (template, expressionTypes, bindingTypes, getComponent) {
    return template('<conditional-slot expr1="expr1"></conditional-slot>', [
      {
        type: bindingTypes.TAG,
        getComponent: getComponent,

        evaluate: function (_scope) {
          return 'conditional-slot'
        },

        slots: [
          {
            id: 'default',
            html: '<p>Hello there</p><b expr2="expr2"></b>',

            bindings: [
              {
                type: bindingTypes.IF,

                evaluate: function (_scope) {
                  return _scope.state.mustShowSlot
                },

                redundantAttribute: 'expr2',
                selector: '[expr2]',

                template: template('I am visible', []),
              },
            ],
          },
        ],

        attributes: [
          {
            type: expressionTypes.ATTRIBUTE,
            name: 'is-visible',

            evaluate: function (_scope) {
              return _scope.state.mustShowSlot
            },
          },
        ],

        redundantAttribute: 'expr1',
        selector: '[expr1]',
      },
    ])
  },

  name: 'conditional-slot-parent',
} as RiotComponentWrapper<ReturnType<typeof exports>>
