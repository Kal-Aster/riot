import * as riot from '../../src/riot.js'

import Issue2895Parent from '../components/issue-2895-parent.riot'
import Issue2994ClassDuplication from '../components/issue-2994-class-duplication.riot'
import Issue2994ClassDuplicationNestedExpression from '../components/issue-2994-class-duplication-nested-expression.riot'
import Issue3003Parent from '../components/issue-3003-parent.riot'
import MergeAttributes from '../components/merge-attributes.riot'
import VirtualEach from '../components/virtual-each.riot'

import { expect } from 'chai'

describe('components rendering', () => {
  it('multiple expression on the same attribute will be merged', () => {
    const element = document.createElement('merge-attributes')
    const component = riot.component(MergeAttributes)(element, {
      name: 'Jack',
      surname: 'Black',
    })

    expect(component.root.getAttribute('name')).to.be.equal('Jack-Black')

    component.unmount()
  })

  it('nested template tags will be properly rendered', () => {
    const element = document.createElement('virtual-each')
    const component = riot.component(VirtualEach)(element, {
      items: [
        { title: 'hello', description: 'world' },
        { title: 'hello', description: 'world' },
        { title: 'hello', description: 'world' },
      ],
    })

    expect(component.$$('dd')).to.have.length(3)
    expect(component.$('template')).to.be.not.ok

    component.update({
      items: null,
    })

    expect(component.$$('dd')).to.have.length(0)
    expect(component.$('template')).to.be.not.ok

    component.unmount()
  })

  it('avoid recursive child parent infinite event lifecycle loops', () => {
    const element = document.createElement('issue-2895-parent')
    const component = riot.component(Issue2895Parent)(element)

    expect(component.$('p').innerHTML).to.be.equal('hello')
    expect(component.$('h1').innerHTML).to.be.equal('hello')

    component.unmount()
  })

  it('the class attributes should be not be recursively applied', () => {
    const element = document.createElement('issue-2994-class-duplication')
    const component = riot.component(Issue2994ClassDuplication)(element, {
      dropdown: false,
    })

    expect(element.getAttribute('class').trim()).to.be.equal('btn')

    component.update({
      dropdown: true,
    })

    expect(element.getAttribute('class').trim()).to.be.equal('btn  dropdown')

    component.unmount()
  })

  it('the class attribute should be available as component prop (https://github.com/riot/riot/issues/3003#issuecomment-2080160160)', () => {
    const element = document.createElement(
      'issue-2994-class-duplication-nested-expression',
    )
    element.classList.add('btn')

    const component = riot.component(Issue2994ClassDuplicationNestedExpression)(
      element,
    )

    expect(component.props.class).to.be.equal('btn')

    element.classList.add('dropdown')
    component.update()

    expect(component.props.class).to.be.equal('btn dropdown')

    component.unmount()
  })

  it('nested static components can be rendered without errors', () => {
    const element = document.createElement('issue-3003-parent')
    const component = riot.component(Issue3003Parent)(element)

    expect(() => component.update()).to.not.throw()

    component.unmount()
  })
})
