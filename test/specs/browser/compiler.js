describe('Compiler Browser', function() {

  var tags = []
  // version# for IE 8-11, 0 for others
  var IE_VERSION = (window && window.document || {}).documentMode | 0

  // adding some custom riot parsers
  // css
  riot.parsers.css.myparser = function(tag, css) {
    return css.replace(/@tag/, tag).replace(' 3px ', ' 4px ')
  }
  // js
  riot.parsers.js.myparser = function(js) {
    return js.replace(/@version/, '1.0.0')
  }

  before(function(next) {
    this.timeout(1000000) // on saucelabs is REALLY slow
    riot.compile(next)
  })

  after(function() {
    var unmount = function (el) {
      if (el.length) {
        el.forEach(unmount)
      } else {
        if (el.isMounted) el.unmount()
      }
    }
    unmount(tags)
  })

  afterEach(function() {
    // restore the default brackets
    riot.settings.brackets = defaultBrackets

    var dft = defineTag.names || [], mtg = makeTag.tags || []
    dft.forEach(function(name) { riot.unregister(name) })
    mtg.forEach(function(tag) { tag.unmount() })
    defineTag.names = []
    makeTag.tags = []
  })

  it('populates the vdom property correctly on riot global', function() {
    injectHTML('<v-dom-1></v-dom-1>')
    injectHTML('<v-dom-2></v-dom-2>')
    var tags = riot.mount('v-dom-1, v-dom-2')

    expect(tags.length).to.be(2)
    expect(riot.vdom.length).to.be(tags.length)
    riot.vdom.forEach(function(tag, i) {
      expect(tag).to.be(tags[i])
    })
  })

  it('compiles and unmount the children tags', function(done) {

    this.timeout(5000)

    var ticks = 0,
      tag = riot.mount('timetable', {
        start: 0,
        ontick: function() {
          ticks++
        }
      })[0]

    expect($$('timer', tag.root).length).to.be(3)

    riot.update()

    expect(tag.tags.foo).to.not.be(undefined)

    tag.unmount()

    // no time neither for one tick
    // because the tag got unMounted too early
    setTimeout(function() {
      expect(ticks).to.be(0)
      done()
    }, 1200)

  })

  it('compiler performance', function() {
    var src =  [
      '<foo>',
      '  <p>{ opts.baz } { bar }</p>',

      '  this.bar = "romutus"',

      '</foo>',
      '<timetable>',
      '   <timer ontick={ parent.opts.ontick } start={ time } each={ time, i in times }></timer>',
      '   <foo barz="899" baz="90"></foo>',
      '   <p>{ kama }</p>',

      '   this.times = [ 1, 3, 5 ]',
      '   this.kama = "jooo"',
      '<\/timetable>'
    ].join('\n')

    // check riot.compile is actually compiling the source
    expect(riot.compile(src, true)).to.contain("('timetable', '")

    // compile timer 1000 times and see how long it takes
    var begin = Date.now()

    for (var i = 0; i < 1000; i++) {
      riot.compile(src, true)
    }

    expect(Date.now() - begin).to.be.below(1500) // compiler does more now

  })

  it('compile a custom tag using custom css and js parsers', function() {

    var tag = riot.mount('custom-parsers')[0],
      styles = getRiotStyles()

    expect(tag).to.be.an('object')
    expect(tag.version).to.be('1.0.0')
    expect(styles).to.match(/\bcustom-parsers\ ?\{\s*color: red;}/)

    tags.push(tag)

  })

  it('mount and unmount', function() {

    riot.tag('test', '<p>val: { opts.val }<\/p>')

    injectHTML([
      '<test id="test-tag"></test>',
      '<div id="foo"></div>',
      '<div id="bar"></div>'
    ])

    var tag = riot.mount('test', { val: 10 })[0],
      tag2 = riot.mount('#foo', 'test', { val: 30 })[0],
      tag3 = riot.mount(document.getElementById('bar'), 'test', { val: 50 })[0]

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>val: 10</p>')
    expect(normalizeHTML(tag2.root.innerHTML)).to.be('<p>val: 30</p>')
    expect(normalizeHTML(tag3.root.innerHTML)).to.be('<p>val: 50</p>')

    tag.unmount()
    tag2.unmount()
    tag3.unmount(true)

    expect(tag3.isMounted).to.be(false)

    expect(document.body.getElementsByTagName('test').length).to.be(0)
    expect(document.getElementById('foo')).to.be(null)
    expect(document.getElementById('bar')).to.not.be(null)

    expect(tag.root._tag).to.be(undefined)
    expect(tag2.root._tag).to.be(undefined)
    expect(tag3.root._tag).to.be(undefined)

  })

  it('mount a tag mutiple times', function() {

    injectHTML([
       // mount the same tag multiple times
      '<div id="multi-mount-container-1"></div>',

      // multple mount using *
      '<div id="multi-mount-container-2">',
      '    <test-i></test-i>',
      '    <test-l></test-l>',
      '    <test-m></test-m>',
      '<\/div>'
    ])

    var tag = riot.mount('#multi-mount-container-1', 'test', { val: 300 })[0]

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>val: 300</p>')

    riot.tag('test-h', '<p>{ x }</p>', function() { this.x = 'ok'})

    tag = riot.mount('#multi-mount-container-1', 'test-h')[0]

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>ok</p>')

    tags.push(tag)

  })

  it('mount a tag mutiple times using "*"', function() {


    riot.tag('test-i', '<p>{ x }</p>', function() { this.x = 'ok'})
    riot.tag('test-l', '<p>{ x }</p>', function() { this.x = 'ok'})
    riot.tag('test-m', '<p>{ x }</p>', function() { this.x = 'ok'})

    var subTags = riot.mount('#multi-mount-container-2', '*')

    expect(subTags.length).to.be(3)

    subTags = riot.mount(document.getElementById('multi-mount-container-2'), '*')

    expect(subTags.length).to.be(3)

    tags.push(subTags)

  })

  it('the loop elements keep their position in the DOM', function() {
    var tag = riot.mount('loop-position')[0],
      h3 = tag.root.getElementsByTagName('h3')[0]

    expect(getPreviousSibling(h3).tagName.toLowerCase()).to.be('p')
    expect(getNextSibling(h3).tagName.toLowerCase()).to.be('p')

    tags.push(tag)

  })

  it('SVGs nodes can be properly looped', function() {
    var tag = riot.mount('loop-svg-nodes')[0]

    expect($$('svg circle', tag.root).length).to.be(3)

    tags.push(tag)
  })

  it('the root keyword should be protected also in the loops', function() {
    var tag = riot.mount('loop-root')[0]

    expect($$('li', tag.root).length).to.be(3)

    tag.splice()
    tag.update()

    expect($$('li', tag.root).length).to.be(2)

    tags.push(tag)

  })

  it('avoid to duplicate tags in multiple foreach loops', function() {

    injectHTML([
      '<outer id="outer1"></outer>',
      '<outer id="outer2"></outer>',
      '<outer id="outer3"></outer>'
    ])

    var mountTag = function(tagId) {
      var data = [],
        tag,
        itemsCount = 5

      while (itemsCount--) {
        data.push({
          value: 'item #' + itemsCount
        })
      }

      tag = riot.mount(tagId, {data: data})[0]
      // comment the following line to check the rendered html
      tags.push(tag)

    }

    mountTag('#outer1')
    mountTag('#outer2')
    mountTag('#outer3')

    expect(outer1.getElementsByTagName('outer-inner').length).to.be(5)
    expect(outer1.getElementsByTagName('span').length).to.be(5)
    expect(outer1.getElementsByTagName('p').length).to.be(5)
    expect(outer2.getElementsByTagName('outer-inner').length).to.be(5)
    expect(outer2.getElementsByTagName('span').length).to.be(5)
    expect(outer2.getElementsByTagName('p').length).to.be(5)
    expect(outer3.getElementsByTagName('outer-inner').length).to.be(5)
    expect(outer3.getElementsByTagName('span').length).to.be(5)
    expect(outer3.getElementsByTagName('p').length).to.be(5)

  })

  it('the each loops update correctly the DOM nodes', function() {
    var onItemClick = function(e) {
        var elIndex = Array.prototype.slice.call(children).indexOf(e.currentTarget)
        expect(tag.items[elIndex]).to.be.equal(e.item.item)
      },
      removeItemClick = function(e) {
        var index = tag.removes.indexOf(e.item)
        if (index < 0) return
        tag.removes.splice(index, 1)
      },
      tag = riot.mount('loop', { onItemClick: onItemClick, removeItemClick: removeItemClick })[0],
      root = tag.root,
      button = root.getElementsByTagName('button')[0],
      children,
      itemsCount = 5

    tags.push(tag)

    tag.items = []
    tag.removes = []

    while (itemsCount--) {
      tag.removes.push({
        value: 'remove item #' + tag.items.length
      })
      tag.items.push({
        value: 'item #' + tag.items.length
      })
    }
    tag.update()

    // remove item make sure item passed is correct
    for (var i = 0; i < tag.items.length; i++) {
      var curItem = tag.removes[0],
        ev = {},
        el = root.getElementsByTagName('dt')[0]
      el.onclick(ev)
      expect(curItem).to.be(ev.item)
    }

    children = root.getElementsByTagName('li')
    Array.prototype.forEach.call(children, function(child) {
      child.onclick({})
    })
    expect(children.length).to.be(5)

    // no update is required here
    button.onclick({})
    children = root.getElementsByTagName('li')
    expect(children.length).to.be(10)

    Array.prototype.forEach.call(children, function(child) {
      child.onclick({})
    })

    expect(normalizeHTML(root.getElementsByTagName('ul')[0].innerHTML)).to.be('<li>0 item #0 </li><li>1 item #1 </li><li>2 item #2 </li><li>3 item #3 </li><li>4 item #4 </li><li>5 item #5 </li><li>6 item #6 </li><li>7 item #7 </li><li>8 item #8 </li><li>9 item #9 </li>')

    tag.items.reverse()
    tag.update()
    children = root.getElementsByTagName('li')
    expect(children.length).to.be(10)
    Array.prototype.forEach.call(children, function(child) {
      child.onclick({})
    })

    expect(normalizeHTML(root.getElementsByTagName('ul')[0].innerHTML)).to.be('<li>0 item #9 </li><li>1 item #8 </li><li>2 item #7 </li><li>3 item #6 </li><li>4 item #5 </li><li>5 item #4 </li><li>6 item #3 </li><li>7 item #2 </li><li>8 item #1 </li><li>9 item #0 </li>'.trim())

    var tempItem = tag.items[1]
    tag.items[1] = tag.items[8]
    tag.items[8] = tempItem
    tag.update()

    Array.prototype.forEach.call(children, function(child) {
      child.onclick({})
    })

    expect(normalizeHTML(root.getElementsByTagName('ul')[0].innerHTML)).to.be('<li>0 item #9 </li><li>1 item #1 </li><li>2 item #7 </li><li>3 item #6 </li><li>4 item #5 </li><li>5 item #4 </li><li>6 item #3 </li><li>7 item #2 </li><li>8 item #8 </li><li>9 item #0 </li>'.trim())

    tag.items = null
    tag.update()
    expect(root.getElementsByTagName('li').length).to.be(0)

  })

  it('event handler on each custom tag doesnt update parent', function() {
    defineTag(`<inner>
      <button id='btn' onclick={foo} />
      foo() {}
    </inner>`)
    var tag = makeTag(`
      <inner each={item in items} />
      this.items = [1]
      this.updateCount = 0
      this.on('update', function() { this.updateCount++ })
    `)

    expect(tag.updateCount).to.be(0)
    tag.tags.inner[0].btn.onclick({})
    expect(tag.updateCount).to.be(0)
  })

  it('the event.item property gets handled correctly also in the nested loops', function() {
    var tag = riot.mount('loop-events', {
        cb: function(e, item) {
          eventsCounter++
          if (e.stopPropagation)
            e.stopPropagation()
          expect(JSON.stringify(item)).to.be(JSON.stringify(testItem))
        }
      })[0],
      eventsCounter = 0,
      testItem

    // 1st test
    testItem = { outerCount: 'out', outerI: 0 }
    tag.root.getElementsByTagName('inner-loop-events')[0].onclick({})
    // 2nd test inner contents
    testItem = { innerCount: 'in', innerI: 0 }
    tag.root.getElementsByTagName('button')[1].onclick({})
    tag.root.getElementsByTagName('li')[0].onclick({})

    expect(eventsCounter).to.be(3)

    tags.push(tag)

  })

  it('can loop also collections including null items', function() {
    var tag = riot.mount('loop-null-items')[0]
    expect($$('li', tag.root).length).to.be(7)
    tags.push(tag)
  })

  it('each loop creates correctly a new context', function() {

    var tag = riot.mount('loop-child')[0],
      root = tag.root,
      children = root.getElementsByTagName('looped-child')

    expect(children.length).to.be(2)
    expect(tag.tags['looped-child'].length).to.be(2)
    expect(tag.tags['looped-child'][0].hit).to.be.a('function')
    expect(normalizeHTML(children[0].innerHTML)).to.be('<h3>one</h3><button>one</button>')
    expect(normalizeHTML(children[1].innerHTML)).to.be('<h3>two</h3><button>two</button>')

    tag.items = [ {name: 'one'}, {name: 'two'}, {name: 'three'} ]
    tag.update()
    expect(root.getElementsByTagName('looped-child').length).to.be(3)

    expect(tag.tags['looped-child'][2].isMounted).to.be(true)
    expect(tag.tags['looped-child'].length).to.be(3)

    expect(root.getElementsByTagName('looped-child')[0].style.color).to.be('red')
    root.getElementsByTagName('looped-child')[0].getElementsByTagName('button')[0].onclick({})
    expect(root.getElementsByTagName('looped-child')[0].style.color).to.be('blue')


    tags.push(tag)

  })

  it('the loop children tags must fire the \'mount\' event when they are already injectend into the parent', function(done) {
    var tag = tag = riot.mount('loop-child')[0],
      root = tag.root

    setTimeout(function() {
      tag.tags['looped-child'].forEach(function(child) {
        expect(child.mountWidth).to.be.above(0)
      })

      tag.childrenMountWidths.forEach(function(width) {
        expect(width).to.be.above(0)
      })

      done()
    }, 100)

  })

  it('the mount method could be triggered also on several tags using a NodeList instance', function() {

    injectHTML([
      '<multi-mount value="1"></multi-mount>',
      '<multi-mount value="2"></multi-mount>',
      '<multi-mount value="3"></multi-mount>',
      '<multi-mount value="4"></multi-mount>'
    ])

    riot.tag('multi-mount', '{ opts.value }')

    var multipleTags = riot.mount(document.querySelectorAll('multi-mount'))

    expect(multipleTags[0].root.innerHTML).to.be('1')
    expect(multipleTags[1].root.innerHTML).to.be('2')
    expect(multipleTags[2].root.innerHTML).to.be('3')
    expect(multipleTags[3].root.innerHTML).to.be('4')

    var i = multipleTags.length

    while (i--) {
      tags.push(multipleTags[i])
    }

  })

  it('the `array.unshift` method does not break the loop', function() {

    var tag = riot.mount('loop-unshift')[0]

    expect(tag.tags['loop-unshift-item'].length).to.be(2)
    expect(normalizeHTML(tag.root.getElementsByTagName('loop-unshift-item')[0].innerHTML)).to.be('<p>woo</p>')
    tag.items.unshift({ name: 'baz' })
    tag.update()
    expect(normalizeHTML(tag.root.getElementsByTagName('loop-unshift-item')[0].innerHTML)).to.be('<p>baz</p>')

    tags.push(tag)

  })

  it('each loop adds and removes items in the right position (when multiple items share the same html)', function() {

    var tag = riot.mount('loop-manip')[0],
      root = tag.root,
      children = root.getElementsByTagName('loop-manip')

    tags.push(tag)

    tag.top()
    tag.update()
    tag.bottom()
    tag.update()
    tag.top()
    tag.update()
    tag.bottom()
    tag.update()

    expect(normalizeHTML(root.getElementsByTagName('ul')[0].innerHTML)).to.be('<li>100 <a>remove</a></li><li>100 <a>remove</a></li><li>0 <a>remove</a></li><li>1 <a>remove</a></li><li>2 <a>remove</a></li><li>3 <a>remove</a></li><li>4 <a>remove</a></li><li>5 <a>remove</a></li><li>100 <a>remove</a></li><li>100 <a>remove</a></li>'.trim())


  })

  it('tags in different each loops dont collide', function() {

    var tag = riot.mount('loop-combo')[0]
    tags.push(tag)

    expect(normalizeHTML(tag.root.innerHTML))
      .to.be('<lci x="a"></lci><div><lci x="y"></lci></div>')

    tag.update({b: ['z']})

    expect(normalizeHTML(tag.root.innerHTML))
      .to.be('<lci x="a"></lci><div><lci x="z"></lci></div>')
  })

  it('iterate over an object, then modify the property and update itself', function() {

    var tag = riot.mount('loop-object')[0]
    var root = tag.root

    tags.push(tag)

    expect(normalizeHTML(root.getElementsByTagName('div')[0].innerHTML))
      .to.be('<p>zero = 0</p><p>one = 1</p><p>two = 2</p><p>three = 3</p>')

    for (key in tag.obj)                              // eslint-disable-line guard-for-in
      tag.obj[key] = tag.obj[key] * 2
    tag.update()
    expect(normalizeHTML(root.getElementsByTagName('div')[0].innerHTML))
      .to.be('<p>zero = 0</p><p>one = 2</p><p>two = 4</p><p>three = 6</p>')

  })

  it('all the nested tags will are correctly pushed to the parent.tags property', function() {

    var tag = riot.mount('nested-child')[0],
      root = tag.root

    tags.push(tag)

    expect(tag.tags.child.length).to.be(6)
    expect(tag.tags['another-nested-child']).to.be.an('object')
    tag.tags.child[0].unmount()
    expect(tag.tags.child.length).to.be(5)
    tag.tags['another-nested-child'].unmount()
    expect(tag.tags['another-nested-child']).to.be(undefined)

  })

  it('the loop children instances get correctly removed in the right order', function() {

    var tag = riot.mount('loop-ids')[0],
      thirdItemId = tag.tags['loop-ids-item'][2]._riot_id

    tag.items.splice(0, 1)
    tag.update(tag.tags['loop-ids-item'])
    expect(tag.items.length).to.be(2)
    // the second tag instance got removed
    // so now the third tag got moved to the second position
    expect(tag.tags['loop-ids-item'][1]._riot_id).to.be(thirdItemId)
    tags.push(tag)

  })

  it('each tag in the "tags" property can be looped', function() {
    var tag = riot.mount('loop-single-tags')[0]

    expect($$('ul li', tag.root).length).to.be(4)

    tags.push(tag)
  })

  it('loop option tag', function() {
    var tag = riot.mount('loop-option')[0],
      root = tag.root,
      options = root.getElementsByTagName('select')[0],
      html = normalizeHTML(root.innerHTML).replace(/ selected="selected"/, '')

    expect(html).to.match(/<select><option value="1">Peter<\/option><option value="2">Sherman<\/option><option value="3">Laura<\/option><\/select>/)

    //expect(options[0].selected).to.be(false)
    expect(options[1].selected).to.be(true)
    expect(options[2].selected).to.be(false)
    expect(options.selectedIndex).to.be(1)
    tags.push(tag)

  })

  it('the named on a select tag gets', function() {
    var tag = riot.mount('named-select')[0]

    expect(tag.daSelect).to.not.be(undefined)
    expect(tag.daSelect.length).to.be(2)

    tags.push(tag)
  })

  it('loop optgroup tag', function() {
    var tag = riot.mount('loop-optgroup')[0],
      root = tag.root,
      html = normalizeHTML(root.innerHTML).replace(/(value="\d") (selected="selected")/, '$2 $1')

    expect(html).to.match(/<select><optgroup label="group 1"><option value="1">Option 1.1<\/option><option value="2">Option 1.2<\/option><\/optgroup><optgroup label="group 2"><option value="3">Option 2.1<\/option><option selected="selected" value="4">Option 2.2<\/option><\/optgroup><\/select>/)

    tags.push(tag)

  })

  it('loop optgroup tag (outer option, no closing option tags)', function() {
    var tag = riot.mount('loop-optgroup2')[0],
      root = tag.root,
      html = normalizeHTML(root.innerHTML).replace(/(value="\d") (disabled="disabled")/g, '$2 $1')

    expect(html).to
      .match(/<select><option selected="selected">&lt;Select Option&gt; ?(<\/option>)?<optgroup label="group 1"><option value="1">Option 1.1 ?(<\/option>)?<option disabled="disabled" value="2">Option 1.2 ?(<\/option>)?<\/optgroup><optgroup label="group 2"><option value="3">Option 2.1 ?(<\/option>)?<option disabled="disabled" value="4">Option 2.2 ?<\/option><\/optgroup><\/select>/)

    tags.push(tag)

  })

  it('loop tr table tag', function() {
    var tag = riot.mount('table-data')[0],
      root = tag.root

    expect(normalizeHTML(root.innerHTML)).to.match(/<h3>Cells<\/h3><table border="1"><tbody><tr><th>One<\/th><th>Two<\/th><th>Three<\/th><\/tr><tr><td>One<\/td><td>Two<\/td><td>Three<\/td><\/tr><\/tbody><\/table><h3>Rows<\/h3><table border="1"><tbody><tr><td>One<\/td><td>One another<\/td><\/tr><tr><td>Two<\/td><td>Two another<\/td><\/tr><tr><td>Three<\/td><td>Three another<\/td><\/tr><\/tbody><\/table>/)

    tags.push(tag)

  })

  it('loop tr in tables preserving preexsisting rows', function() {
    var tag = riot.mount('table-loop-extra-row')[0],
      root = tag.root,
      tr = root.querySelectorAll('table tr')

    expect(tr.length).to.be(5)
    expect(normalizeHTML(tr[0].innerHTML)).to.be('<td>Extra</td><td>Row1</td>')
    expect(normalizeHTML(tr[4].innerHTML)).to.be('<td>Extra</td><td>Row2</td>')

    tags.push(tag)
  })

  it('loop reorder dom nodes', function() {
    var tag = riot.mount('loop-reorder')[0]
    expect(tag.root.querySelectorAll('span')[0].className).to.be('nr-0')
    expect(tag.root.querySelectorAll('div')[0].className).to.be('nr-0')
    tag.items.reverse()
    tag.update()
    expect(tag.root.querySelectorAll('span')[0].className).to.be('nr-5')
    expect(tag.root.querySelectorAll('div')[0].className).to.be('nr-0')

    tags.push(tag)
  })

  it('brackets', function() {

    injectHTML([
      '<test-a></test-a>',
      '<test-b></test-b>',
      '<test-c></test-c>',
      '<test-d></test-d>',
      '<test-e></test-e>',
      '<test-f></test-f>',
      '<test-g></test-g>'
    ])

    var tag

    riot.settings.brackets = '[ ]'
    riot.tag('test-a', '<p>[ x ]</p>', function() { this.x = 'ok'})
    tag = riot.mount('test-a')[0]
    tags.push(tag)

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>ok</p>')

    riot.settings.brackets = '${ }'
    riot.tag('test-c', '<p>${ x }</p>', function() { this.x = 'ok' })
    tag = riot.mount('test-c')[0]
    tags.push(tag)

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>ok</p>')

    riot.settings.brackets = null
    riot.tag('test-d', '<p>{ x }</p>', function() { this.x = 'ok' })
    tag = riot.mount('test-d')[0]
    tags.push(tag)

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>ok</p>')

    riot.settings.brackets = '[ ]'
    riot.tag('test-e', '<p>[ x ]</p>', function() { this.x = 'ok' })
    tag = riot.mount('test-e')[0]
    tags.push(tag)

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>ok</p>')

    riot.settings.brackets = '${ }'
    riot.tag('test-f', '<p>${ x }</p>', function() { this.x = 'ok' })
    tag = riot.mount('test-f')[0]
    tags.push(tag)

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>ok</p>')

    riot.settings.brackets = null
    riot.tag('test-g', '<p>{ x }</p>', function() { this.x = 'ok' })
    tag = riot.mount('test-g')[0]
    tags.push(tag)

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>ok</p>')

  })

  it('data-is attribute', function() {

    injectHTML('<div id="rtag" data-is="rtag"><\/div>')
    riot.tag('rtag', '<p>val: { opts.val }</p>')

    var tag = riot.mount('#rtag', { val: 10 })[0]
    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>val: 10</p>')

    tag.unmount()
    expect(document.body.getElementsByTagName('rtag').length).to.be(0)

  })

  it('data-is attribute by tag name', function() {

     // data-is attribute by tag name

    riot.tag('rtag2', '<p>val: { opts.val }</p>')

    injectHTML('<div data-is="rtag2"></div>')

    tag = riot.mount('rtag2', { val: 10 })[0]
    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>val: 10</p>')

    tag.unmount()
    expect(document.body.querySelectorAll('rtag2').length).to.be(0)

  })

  it('data-is attribute using the "*" selector', function() {

    injectHTML([
      '<div id="rtag-nested">',
      '  <div data-is="rtag"></div>',
      '  <div data-is="rtag"></div>',
      '  <div data-is="rtag"></div>',
      '</div>'
    ])

    var subTags = riot.mount('#rtag-nested', '*', { val: 10 })

    expect(subTags.length).to.be(3)

    expect(normalizeHTML(subTags[0].root.innerHTML)).to.be('<p>val: 10</p>')
    expect(normalizeHTML(subTags[1].root.innerHTML)).to.be('<p>val: 10</p>')
    expect(normalizeHTML(subTags[2].root.innerHTML)).to.be('<p>val: 10</p>')

    tags.push(subTags)

  })

  it('tags property in loop, varying levels of nesting', function() {

    injectHTML([
      '<ploop-tag></ploop-tag>',
      '<ploop1-tag></ploop1-tag>',
      '<ploop2-tag></ploop2-tag>',
      '<ploop3-tag></ploop3-tag>'
    ])

    var tag = riot.mount('ploop-tag, ploop1-tag, ploop2-tag, ploop3-tag', {
      elements: [{
        foo: 'foo',
        id: 0
      }, {
        foo: 'bar',
        id: 1
      }]
    })

    expect(tag[0].tags['ploop-child'].length).to.be(2)
    expect(tag[0].tags['ploop-another']).to.be.an('object')
    expect(tag[1].tags['ploop-child'].length).to.be(2)
    expect(tag[1].tags['ploop-another'].length).to.be(2)
    expect(tag[2].tags['ploop-child'].length).to.be(2)
    expect(tag[2].tags['ploop-another']).to.be.an('object')
    expect(tag[3].tags['ploop-child'].length).to.be(2)
    expect(tag[3].tags['ploop-another']).to.be.an('object')

    tags.push(tag)
  })

  it('simple html transclusion via <yield> tag', function() {

    defineTag('<inner><p> {opts.value} </p></inner>')
    injectHTML([
      '<inner-html>',
      '  { greeting }',
      '  <inner value="ciao mondo"></inner>',
      '</inner-html>'
    ])

    var tag = riot.mount('inner-html')[0]

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<h1>Hello, World  <inner value="ciao mondo"><p> ciao mondo </p></inner></h1>')
    tags.push(tag)

  })

  it('<yield> from/to multi-transclusion', function() {
    injectHTML('<yield-multi><yield to="content">content</yield><yield to="nested-content">content</yield><yield to="nowhere">content</yield></yield-multi>')
    var tag = riot.mount('yield-multi', {})[0]
    expect(normalizeHTML(tag.root.innerHTML)).to.be('<p>yield the content here</p><div><p>yield the nested content here</p><p>do not yield the unreference content here</p></div>')
    tags.push(tag)
  })

  it('<yield> from/to multi-transclusion nested #1458', function() {
    var html = [
      '<yield-multi2>',
      '  <yield to="options">',
      '    <ul>',
      '      <li>Option 1</li>',
      '      <li>Option 2</li>',
      '    </ul>',
      '  </yield>',
      '  <div>',
      '    <yield to="toggle"><span class="icon"></span></yield>',
      '    <yield to="hello">Hello</yield><yield to="world">World</yield>',
      '    <yield to="hello">dummy</yield>',
      '  </div>',
      '</yield-multi2>'
    ]
    injectHTML(html.join('\n'))
    expect($('yield-multi2')).not.to.be(null)
    var tag = riot.mount('yield-multi2', {})[0]
    html = '<ul><li>Option 1</li><li>Option 2</li></ul><span class="icon"></span><p>Hello World</p>'
    expect(normalizeHTML(tag.root.innerHTML)).to.be(html)
    tags.push(tag)
  })

  it('<yield from> name can be unquoted, without <yield to> default to its content', function () {
    var html = [
      '<yield-from-default>',
      ' <yield to="icon">my-icon</yield>',
      ' <yield to="hello">Hello $1 $2</yield>',
      ' <yield to="loop">[⁗foo⁗,\'bar\']</yield>',
      '</yield-from-default>'
    ]

    injectHTML(html.join('\n'))
    expect($('yield-from-default')).not.to.be(null)
    var tag = riot.mount('yield-from-default')[0]
    html = '<p>(no options)</p><p>Hello $1 $2 <span class="my-icon"></span></p><p>foo</p><p>bar</p>'
    expect(normalizeHTML(tag.root.innerHTML)).to.be(html)
    tags.push(tag)
  })

  it('multiple mount <yield> tag', function() {

    defineTag('<inner><p> {opts.value} </p></inner>')
    riot.mount('inner-html')
    riot.mount('inner-html')
    riot.mount('inner-html')
    riot.mount('inner-html')
    tag = riot.mount('inner-html')[0]

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<h1>Hello, World  <inner value="ciao mondo"><p> ciao mondo </p></inner></h1>')
    tags.push(tag)

  })

  it('<yield> contents in a child get always compiled using its parent data', function(done) {

    injectHTML('<yield-parent>{ greeting }</yield-parent>')

    var tag = riot.mount('yield-parent', {
      saySomething: done
    })[0]

    expect(normalizeHTML(tag.root.innerHTML)).to.match(/<h1>Hello, from the parent<\/h1><yield-child><h1>Greeting<\/h1><i>from the child<\/i><div(.+|)><b>wooha<\/b><\/div><\/yield-child>/)

    tag.update({
      isSelected: true
    })

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<h1>Hello, from the parent</h1><yield-child><h1>Greeting</h1><i>from the child</i><div class="selected"><b>wooha</b></div></yield-child>')

    tag.root.getElementsByTagName('i')[0].onclick({})

    tags.push(tag)

  })

  it('<yield> contents in a loop get always compiled using its parent data', function(done) {

    injectHTML([
      '<yield-loop>',
      '  { greeting }',
      '  <div>Something else</div>',
      '</yield-loop>'
    ])

    var tag = riot.mount('yield-loop', {
        saySomething: done
      })[0],
      child3

    expect(tag.tags['yield-child-2'].length).to.be(5)

    child3 = tag.tags['yield-child-2'][3]

    expect(child3.root.getElementsByTagName('h2')[0].innerHTML.trim()).to.be('subtitle4')

    child3.root.getElementsByTagName('i')[0].onclick({})

    tags.push(tag)

  })

  it('<yield> with dollar signs get replaced correctly', function() {

    injectHTML([
      '<yield-with-dollar-2>',
      '  <yield-with-dollar-1 cost="$25"></yield-with-dollar-1>',
      '</yield-with-dollar-2>'
    ])

    riot.tag('yield-with-dollar-1', '<span>{opts.cost}</span>')
    riot.tag('yield-with-dollar-2', '<yield></yield>')

    var tag = riot.mount('yield-with-dollar-2')[0]

    expect(normalizeHTML(tag.root.innerHTML)).to.be('<yield-with-dollar-1 cost="$25"><span>$25</span></yield-with-dollar-1>')

    tags.push(tag)

  })


  it('top level attr manipulation', function() {

    injectHTML('<top-level-attr value="initial"></top-level-attr>')

    riot.tag('top-level-attr', '{opts.value}')

    var tag = riot.mount('top-level-attr')[0]

    tag.root.setAttribute('value', 'changed')
    tag.update()

    expect(tag.root.innerHTML).to.be('changed')

    tags.push(tag)
  })

  it('top level attr manipulation having expression', function() {

    riot.tag('top-level-attr', '{opts.value}')

    var tag = riot.mount('top-level-attr')[0]

    tag.root.setAttribute('value', '{1+1}')
    tag.update()

    expect(tag.root.innerHTML).to.be('2')

    tags.push(tag)

  })

  it('dynamically named elements in a loop', function() {
    var tag = riot.mount('loop-named')[0]
    tag.on('mount', function () {
      expect(tag.first).name.to.be('first')
      expect(tag.two).name.to.be('two')
    })
    tags.push(tag)
  })

  it('style injection to single style tag', function() {
    var styles = getRiotStyles()

    expect(styles).to.match(/\bp\s*\{color: blue;}/)
    expect(styles).to.match(/\bdiv\s*\{color: red;}/)
  })

  // working
  it('style injection removes type riot style tag', function() {
    var stag = document.querySelector('style[type=riot]')
    expect(stag).to.be(null)
  })

  if (typeof window.__karma__ === 'undefined') {
    it('style tag sits in between title and link to stylesheet', function () {
      var stag = document.querySelector('style')
      var prevE = stag.previousElementSibling
      var nextE = stag.nextElementSibling
      expect(prevE.tagName).to.be('TITLE')
      expect(nextE.tagName).to.be('LINK')
    })
  }

  it('scoped css tag supports htm5 syntax, multiple style tags', function () {

    checkCSS(riot.mount('style-tag3')[0], '4px')
    checkCSS(riot.mount('style-tag4')[0], '2px', 1)
    delete riot.parsers.css.cssup

    function checkCSS(t, x, p2) {
      t.update()
      var e = t.root.firstElementChild
      expect(e.tagName).to.be('P')
      expect(window.getComputedStyle(e, null).borderTopWidth).to.be(x)
      if (p2) {
        e = t.root.getElementsByTagName('P')[1]
        expect(e.innerHTML).to.be('x')
        expect(window.getComputedStyle(e, null).borderTopWidth).to.be('1px')
      }
      tags.push(t)
    }
  })

  it('scoped css and data-is, mount(selector, tagname)', function() {


    function checkBorder(t) {
      var e = t.root.firstElementChild
      var s = window.getComputedStyle(e, null).borderTopWidth
      expect(s).to.be('1px')

    }

    injectHTML([
      '<scoped-tag></scoped-tag>',
      '<div data-is="scoped-tag"></div>',
      '<div id="scopedtag"></div>'
    ])

    var stags = riot.mount('scoped-tag')

    var tag = stags[0]
    checkBorder(tag)

    var rtag = stags[1]
    checkBorder(rtag)

    var divtag = riot.mount('#scopedtag', 'scoped-tag')[0]
    checkBorder(divtag)
    tags.push(divtag)
    tags.push(rtag)
    tags.push(tag)
  })

  it('deferred injection of styles in batch', function() {

    // test riot.util.styleNode
    expect(riot.util.styleNode).to.not.be(undefined)
    expect(riot.util.styleNode.tagName).to.be('STYLE')

    // test style isn't injected yet
    styles = getRiotStyles()
    expect(styles).not.to.match(/\bparsed-style\s*\{/)

    // define a styled tag
    riot.tag('runtime-style-parsing', '<div></div>', '.parsed-style { color: red; }', '', function(opts) { })

    // test style isn't injected by the simple tag definition
    styles = getRiotStyles()
    expect(styles).not.to.match(/\bparsed-style\s*\{/)

    // mount the tag
    injectHTML(['<runtime-style-parsing></runtime-style-parsing>' ])
    var tag = riot.mount('runtime-style-parsing')[0]

    // test style is correctly injected
    styles = getRiotStyles()
    expect(styles).to.match(/\bparsed-style\s*\{\s*color:\s*red;\s*}/)

    // remount (unmount+mount)
    tag.unmount(true)
    tag = riot.mount('runtime-style-parsing')[0]
    expect(tag).to.not.be(undefined)

    // test remount does not affect style
    styles = getRiotStyles()
    expect(styles).to.match(/\bparsed-style\s*\{\s*color:\s*red;\s*}/)

    // test remount does not duplicate rule
    expect(styles.match(/\bparsed-style\s*\{/g)).to.have.length(1)
  })

  it('preserve attributes from tag definition', function() {
    injectHTML('<div data-is="preserve-attr2"></div>')
    var tag = riot.mount('preserve-attr')[0]
    expect(tag.root.className).to.be('single-quote')
    var tag2 = riot.mount('preserve-attr2')[0]
    expect(tag2.root.className).to.be('double-quote')
    tags.push(tag)
    tags.push(tag2)
  })

  it('precompiled tag compatibility', function() {

    injectHTML('<precompiled></precompiled>')
    riot.tag('precompiled', 'HELLO!', 'precompiled, [data-is="precompiled"]  { color: red }', function(opts) {
      this.nothing = opts.nothing
    })

    var tag = riot.mount('precompiled')[0]
    expect(window.getComputedStyle(tag.root, null).color).to.be('rgb(255, 0, 0)')
    tags.push(tag)

  })

  it('static named tag for tags property', function() {
    injectHTML('<named-child-parent></named-child-parent>')
    var tag = riot.mount('named-child-parent')[0]
    expect(tag['tags-child'].root.innerHTML).to.be('I have a name')

    tags.push(tag)
  })

  it('preserve the mount order, first the parent and then all the children', function() {
    var correctMountingOrder = [
        'deferred-mount',
        'deferred-child-1',
        'deferred-child-2',
        'deferred-loop',
        'deferred-loop',
        'deferred-loop',
        'deferred-loop',
        'deferred-loop'
      ],
      mountingOrder = [],
      cb = function(tagName, childTag) {
        // make sure the mount event gets triggered when all the children tags
        // are in the DOM
        expect(document.contains(childTag.root)).to.be(true)
        mountingOrder.push(tagName)
      },
      tag = riot.mount('deferred-mount', { onmount: cb })[0]

    expect(mountingOrder.join()).to.be(correctMountingOrder.join())

    tags.push(tag)
  })

  it('no update should be triggered if the preventUpdate flag is set', function() {
    var tag = riot.mount('prevent-update')[0]

    expect(tag['fancy-name'].innerHTML).to.be('john')

    tag.root.getElementsByTagName('p')[0].onclick({})

    expect(tag['fancy-name'].innerHTML).to.be('john')

    tags.push(tag)
  })

  it('the before events get triggered', function() {
    var eventsCount = 0,
      tag,
      incrementEvents = function () {
        eventsCount++
      }
    riot.tag('before-events', '', function() {
      this.on('before-mount', incrementEvents)
      this.on('before-unmount', incrementEvents)
    })
    tag = riot.mount(document.createElement('before-events'))[0]
    tag.unmount()
    expect(eventsCount).to.be.equal(2)
  })

  it('child tags are only rendered when if-condition is truthy', function() {
    var tag = riot.mount('if-mount')[0]

    var expectL2 = function(base, exist) {
      var ex = expect(base.tags['if-level2'])
      exist ? ex.to.not.be(undefined) : ex.to.be(undefined)
      expect($$('if-level2', base.root).length).to.be(exist ? 1 : 0)
    }

    var expectCond = function(base, exist) {
      var ex = expect(base.tags['if-level2'].tags['conditional-tag'])
      exist ? ex.to.not.be(undefined) : ex.to.be(undefined)
      expect($$('conditional-tag', base.root).length).to.be(exist ? 1 : 0)
    }

    expectL2(tag.ff, false)
    expectL2(tag.ft, false)

    expectL2(tag.tf, true)
    expectCond(tag.tf, false)

    expectL2(tag.tt, true)
    expectCond(tag.tt, true)

    tag.tf.tags['if-level2'].toggleCondition()
    expectCond(tag.tf, true)

    tag.ft.toggleCondition()
    expectL2(tag.ft, true)
    expectCond(tag.ft, true)

    tags.push(tag)
  })

  it('tags under a false if statement are unmounted', function() {
    var unmountCount = 0, cb = function() { unmountCount++ }
    var tag = riot.mount('if-unmount', {cb: cb})[0]

    // check that our child tags exist, and record their ids
    expect(tag.tags['if-uchild'].length).to.be(3)
    var firstIds = tag.tags['if-uchild'].map(function(c) { return c._riot_id })

    // set if conditions to false
    tag.items[0].bool = false
    tag.update({cond: false})

    // ensure the tags are gone, and that their umount callbacks were triggered
    expect(tag.tags['if-uchild']).to.be(undefined)
    expect(unmountCount).to.be(3)

    // set conditions back to true
    tag.items[0].bool = true
    tag.update({cond: true})

    // ensure the tags exist, and get their ids
    expect(tag.tags['if-uchild'].length).to.be(3)
    var secondIds = tag.tags['if-uchild'].map(function(c) { return c._riot_id })

    // ensure that all of the new tags are different instances from the first time
    var intersection = secondIds.filter(function(id2) {
      return firstIds.indexOf(id2) > -1
    })
    expect(intersection.length).to.be(0)

    tags.push(tag)
  })

  it('named refs are removed from parent when element leaves DOM', function() {
    injectHTML('<named-unmount></named-unmount>')
    var tag = riot.mount('named-unmount')[0]
    tags.push(tag)

    expect(tag.first).to.be(undefined)
    expect(tag.second).to.be(undefined)

    tag.update({cond: true, items: ['third']})

    expect(tag.first).to.be.an(HTMLElement)
    expect(tag.second).to.be.an(HTMLElement)
    expect(tag.third).to.be.an(HTMLElement)

    tag.update({cond: false, items: []})

    expect(tag.first).to.be(undefined)
    expect(tag.second).to.be(undefined)
    expect(tag.third).to.be(undefined)
  })

  it('preserve the mount order, first the parent and then all the children', function() {
    var correctMountingOrder = [
        'deferred-mount',
        'deferred-child-1',
        'deferred-child-2',
        'deferred-loop',
        'deferred-loop',
        'deferred-loop',
        'deferred-loop',
        'deferred-loop'
      ],
      mountingOrder = [],
      cb = function(tagName, childTag) {
        // make sure the mount event gets triggered when all the children tags
        // are in the DOM
        expect(document.contains(childTag.root)).to.be(true)
        mountingOrder.push(tagName)
      },
      tag = riot.mount('deferred-mount', { onmount: cb })[0]

    expect(mountingOrder.join()).to.be(correctMountingOrder.join())

    tags.push(tag)
  })

  it('only evalutes expressions once per update', function() {

    var tag = riot.mount('expression-eval-count')[0]
    expect(tag.count).to.be(1)
    tag.update()
    expect(tag.count).to.be(2)
    tags.push(tag)
  })

  it('multi named elements to an array', function() {
    var mount = function() {
        var tag = this
        expect(tag.rad[0].value).to.be('1')
        expect(tag.rad[1].value).to.be('2')
        expect(tag.rad[2].value).to.be('3')
        expect(tag.t.value).to.be('1')
        expect(tag.t_1.value).to.be('1')
        expect(tag.t_2.value).to.be('2')
        expect(tag.c[0].value).to.be('1')
        expect(tag.c[1].value).to.be('2')
      },
      mountChild = function() {
        var tag = this
        expect(tag.child.value).to.be('child')
        expect(tag.check[0].value).to.be('one')
        expect(tag.check[1].value).to.be('two')
        expect(tag.check[2].value).to.be('three')

      }
    var tag = riot.mount('multi-named', { mount: mount, mountChild: mountChild })[0]

    tags.push(tag)
  })

  it('input type=number', function() {
    var tag = riot.mount('input-number', {num: 123})[0]
    var inp = tag.root.getElementsByTagName('input')[0]
    expect(inp.getAttribute('type')).to.be('number')
    expect(inp.value).to.be('123')
    tags.push(tag)
  })

  it('the input values should be updated corectly on any update call', function() {
    var tag = riot.mount('input-values')[0]
    expect(tag.i.value).to.be('foo')
    tag.update()
    expect(tag.i.value).to.be('hi')
  })

  it('data-is as expression', function() {
    injectHTML('<container-riot></container-riot>')
    var tag = riot.mount('container-riot')[0]
    var div = tag.root.getElementsByTagName('div')[0]
    expect(div.getAttribute('data-is')).to.be('nested-riot')
    tags.push(tag)
  })

  it('the "updated" event gets properly triggered in a nested child', function(done) {
    injectHTML('<div id="updated-events-tester"></div>')
    var tag = riot.mount('#updated-events-tester', 'named-child-parent')[0],
      counter = 0

    tag.tags['named-child'].on('updated', function() {
      counter ++
      if (counter == 2) done()
    })

    tag.update()
    tag.tags['named-child'].update()

    tags.push(tag)

  })

  it('the "updated" gets properly triggered also from the children tags in a loop', function(done) {

    injectHTML('<div id="updated-events-in-loop"></div>')
    var tag = riot.mount('#updated-events-in-loop', 'loop-unshift')[0],
      counter = 0

    tag.tags['loop-unshift-item'][0].on('updated', function() {
      counter ++
      if (counter == 2) done()
    })

    tag.update()
    tag.tags['loop-unshift-item'][0].update()

    tags.push(tag)

  })

  it('recursive structure', function() {
    var tag = riot.mount('treeview')[0]
    expect(tag).to.be.an('object')
    expect(tag.isMounted).to.be(true)
    tags.push(tag)
  })

  it('the loops children sync correctly their internal data with their options', function() {
    var tag = riot.mount('loop-sync-options')[0]

    function ch(idx) {
      return tag.root.getElementsByTagName('loop-sync-options-child')[idx]._tag
    }

    expect(ch(0).val).to.be('foo')
    expect(ch(0).root.className).to.be('active')
    expect(ch(1).val).to.be(undefined)
    expect(ch(2).val).to.be(undefined)
    expect(ch(0).num).to.be(undefined)
    expect(ch(1).num).to.be(3)
    expect(ch(2).num).to.be(undefined)
    expect(ch(0).bool).to.be(undefined)
    expect(ch(1).bool).to.be(undefined)
    expect(ch(2).bool).to.be(false)
    tag.update({
      children: tag.children.reverse()
    })
    expect(ch(0).val).to.be(undefined)
    expect(ch(0).root.className).to.be('')
    expect(ch(1).val).to.be(undefined)
    expect(ch(2).val).to.be('foo')
    expect(ch(2).root.className).to.be('active')
    expect(ch(0).num).to.be(undefined)
    expect(ch(1).num).to.be(3)
    expect(ch(2).num).to.be(undefined)
    expect(ch(0).bool).to.be(false)
    expect(ch(1).bool).to.be(undefined)
    expect(ch(2).bool).to.be(undefined)

    tag.update({
      children: tag.children.reverse()
    })
    expect(ch(0).val).to.be('foo')
    expect(ch(0).root.className).to.be('active')
    expect(ch(1).val).to.be(undefined)
    expect(ch(2).val).to.be(undefined)
    expect(ch(2).root.className).to.be('')
    expect(ch(0).num).to.be(undefined)
    expect(ch(1).num).to.be(3)
    expect(ch(2).num).to.be(undefined)
    expect(ch(0).bool).to.be(undefined)
    expect(ch(1).bool).to.be(undefined)
    expect(ch(2).bool).to.be(false)
    tags.push(tag)
  })


/*
// TODO: soon it will be possible!
it('raw contents', function() {
    var tag = riot.mount('raw-contents')[0],
      p = $('p', tag.root),
      h1 = $('h1', tag.root),
      span = $('span', tag.root),
      div = $('div', tag.root)

    expect(p.contains(span)).to.be(true)
    // TODO: pass this test
    expect(h1.innerHTML).to.be('Title: ' + p.innerHTML)
    expect(div.getAttribute('data-content')).to.be('<div>Ehy</div><p>ho</p>')
    //tags.push(tag)
  })

*/

  it('the loops children sync correctly their internal data even when they are nested', function() {
    var tag = riot.mount('loop-sync-options-nested')[0]

    expect(tag.tags['loop-sync-options-nested-child'][0].parent.root.tagName.toLowerCase()).to.be('loop-sync-options-nested')
    expect(tag.tags['loop-sync-options-nested-child'][0].val).to.be('foo')
    expect(tag.tags['loop-sync-options-nested-child'][1].val).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][2].val).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][0].num).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][1].num).to.be(3)
    expect(tag.tags['loop-sync-options-nested-child'][2].num).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][0].bool).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][1].bool).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][2].bool).to.be(false)
    tag.update({
      children: tag.children.reverse()
    })
    tag.update()
    expect(tag.tags['loop-sync-options-nested-child'][0].val).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][1].val).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][2].val).to.be('foo')
    expect(tag.tags['loop-sync-options-nested-child'][0].num).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][1].num).to.be(3)
    expect(tag.tags['loop-sync-options-nested-child'][2].num).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][0].bool).to.be(false)
    expect(tag.tags['loop-sync-options-nested-child'][1].bool).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][2].bool).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][2].parent.root.tagName.toLowerCase()).to.be('loop-sync-options-nested')
    tag.update({
      children: tag.children.reverse()
    })
    tag.update()
    expect(tag.tags['loop-sync-options-nested-child'][0].val).to.be('foo')
    expect(tag.tags['loop-sync-options-nested-child'][1].val).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][2].val).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][0].num).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][1].num).to.be(3)
    expect(tag.tags['loop-sync-options-nested-child'][2].num).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][0].bool).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][1].bool).to.be(undefined)
    expect(tag.tags['loop-sync-options-nested-child'][2].bool).to.be(false)

    tags.push(tag)
  })

  it('the children tags are in sync also in multiple nested tags', function() {

    injectHTML('<loop-sync-options-nested-wrapper></loop-sync-options-nested-wrapper>')
    var tag = riot.mount('loop-sync-options-nested-wrapper')[0]
    expect(tag.tags['loop-sync-options-nested'].tags['loop-sync-options-nested-child'].length).to.be(3)
    tags.push(tag)
  })

  it('children in a loop inherit properties from the parent', function() {
    var tag = riot.mount('loop-inherit')[0]
    expect(tag.me.opts.nice).to.be(tag.isFun)
    tag.isFun = false
    tag.update()
    expect(tag.me.opts.nice).to.be(tag.isFun)
    expect(tag.me.tags).to.be.empty()
    tags.push(tag)
  })

  it('loop tags get rendered correctly also with conditional attributes', function(done) {
    var tag = riot.mount('loop-conditional')[0]

    setTimeout(function() {
      expect(tag.root.getElementsByTagName('div').length).to.be(2)
      expect(tag.root.getElementsByTagName('loop-conditional-item').length).to.be(2)
      expect(tag.tags['loop-conditional-item'].length).to.be(2)
      tag.items = []
      tag.update()
      expect(tag.root.getElementsByTagName('div').length).to.be(0)
      expect(tag.root.getElementsByTagName('loop-conditional-item').length).to.be(0)
      expect(tag.tags['loop-conditional-item']).to.be(undefined)
      tag.items = [2, 2, 2]
      tag.update()
      expect(tag.root.getElementsByTagName('div').length).to.be(3)
      expect(tag.root.getElementsByTagName('loop-conditional-item').length).to.be(3)
      expect(tag.tags['loop-conditional-item'].length).to.be(3)
      done()
    }, 100)

    tags.push(tag)
  })

  it('custom children items in a nested loop are always in sync with the parent tag', function() {
    var tag = riot.mount('loop-inherit')[0]

    expect(tag.tags['loop-inherit-item'].length).to.be(4)
    expect(tag.me.opts.name).to.be(tag.items[0])
    expect(tag.you.opts.name).to.be(tag.items[1])
    expect(tag.everybody.opts.name).to.be(tag.items[2])

    tag.items.splice(1, 1)
    tag.update()
    expect(tag.root.getElementsByTagName('div').length).to.be(2)
    expect(tag.tags['loop-inherit-item'].length).to.be(3)

    tag.items.push('active')
    tag.update()
    expect(tag.root.getElementsByTagName('div').length).to.be(3)
    expect(tag.root.getElementsByTagName('div')[2].innerHTML).to.contain('active')
    expect(tag.root.getElementsByTagName('div')[2].className).to.be('active')
    expect(tag.me.opts.name).to.be(tag.items[0])
    expect(tag.you).to.be(undefined)
    expect(tag.everybody.opts.name).to.be(tag.items[1])
    expect(tag.boh.opts.name).to.be('boh')
    expect(tag.tags['loop-inherit-item'].length).to.be(4)

    tags.push(tag)

  })

  it('the DOM events get executed in the right context', function() {
    var tag = riot.mount('loop-inherit')[0]
    tag.tags['loop-inherit-item'][0].root.onmouseenter({})
    expect(tag.wasHovered).to.be(true)
    expect(tag.root.getElementsByTagName('div').length).to.be(4)
    tag.tags['loop-inherit-item'][0].root.onclick({})
    expect(tag.tags['loop-inherit-item'][0].wasClicked).to.be(true)

    tags.push(tag)
  })

  it('loops over other tag instances do not override their internal properties', function() {
    var tag = riot.mount('loop-tag-instances')[0]

    tag.start()

    expect(tag.tags['loop-tag-instances-child'].length).to.be(5)
    expect(tag.tags['loop-tag-instances-child'][0].root.tagName.toLowerCase()).to.be('loop-tag-instances-child')
    tag.update()
    expect(tag.tags['loop-tag-instances-child'][3].root.tagName.toLowerCase()).to.be('loop-tag-instances-child')

    tags.push(tag)

  })

  it('nested loops using non object data get correctly rendered', function() {
    var tag = riot.mount('loop-nested-strings-array')[0],
      children = tag.root.getElementsByTagName('loop-nested-strings-array-item')
    expect(children.length).to.be(4)
    children = tag.root.getElementsByTagName('loop-nested-strings-array-item')
    children[0].onclick({})
    expect(children.length).to.be(4)
    expect(normalizeHTML(children[0].innerHTML)).to.be('<p>b</p>')
    expect(normalizeHTML(children[1].innerHTML)).to.be('<p>a</p>')
    tags.push(tag)
  })

  it('all the events get fired also in the loop tags, the e.item property gets preserved', function() {
    var currentItem,
      currentIndex,
      callbackCalls = 0,
      tag = riot.mount('events', {
        cb: function(e) {
          expect(e.item.val).to.be(currentItem)
          expect(e.item.index).to.be(currentIndex)
          callbackCalls++
        }
      })[0],
      divTags = tag.root.getElementsByTagName('div')



    currentItem = tag.items[0]
    currentIndex = 0
    divTags[0].onclick({})
    tag.items.reverse()
    tag.update()
    currentItem = tag.items[0]
    currentIndex = 0
    divTags[0].onclick({})

    expect(callbackCalls).to.be(2)

    tags.push(tag)
  })

  it('top most tag preserve attribute expressions', function() {
    var tag = riot.mount('top-attributes')[0]
    expect(tag.root.className).to.be('classy') // qouted
    expect(tag.root.getAttribute('data-noquote')).to.be('quotes') // not quoted
    expect(tag.root.getAttribute('data-nqlast')).to.be('quotes') // last attr with no quotes
    expect(tag.root.style.fontSize).to.be('2em') // TODO: how to test riot-prefix?

    var opts = tag.root._tag.opts
    if (opts)
      expect(opts.riotStyle).to.match(/font-size:\s?2em/i)
    else
      console.log('top-attributes._tag.opts not found!')

    tags.push(tag)
  })

  it('camelize the options passed via dom attributes', function() {
    var node = document.createElement('top-attributes'),
      tag

    node.setAttribute('my-random-attribute', 'hello')
    tag = riot.mount(node, {
      'another-random-option': 'hello'
    })[0]
    expect(tag.opts.myRandomAttribute).to.be.equal('hello')
    expect(tag.opts['another-random-option']).to.be.equal('hello')

    tags.push(tag)

  })

  it('the data-is attribute gets updated if a DOM node gets mounted using two or more different tags', function() {
    var div = document.createElement('div')
    tags.push(riot.mount(div, 'timetable')[0])
    expect(div.getAttribute('data-is')).to.be('timetable')
    tags.push(riot.mount(div, 'test')[0])
    expect(div.getAttribute('data-is')).to.be('test')

  })

  it('any DOM event in a loop updates the whole parent tag', function() {
    var tag = riot.mount('loop-numbers-nested')[0]
    expect(tag.root.getElementsByTagName('ul')[0].getElementsByTagName('li').length).to.be(4)
    tag.root.getElementsByTagName('ul')[0].getElementsByTagName('li')[0].onclick({})
    expect(tag.root.getElementsByTagName('ul')[0].getElementsByTagName('li').length).to.be(2)
    tags.push(tag)
  })

  it('riot.observable instances could be also used in a loop', function() {
    var tag = riot.mount('loop-child')[0]

    tag.items = [riot.observable({name: 1}), {name: 2}]
    tag.update()
    tag.items = [{name: 2}]
    tag.update()

    tags.push(tag)
  })

  it('the update event returns the tag instance', function() {
    var tag = riot.mount('loop-child')[0]
    expect(tag.update()).to.not.be(undefined)
    tags.push(tag)
  })

  it('table with multiple bodies and dynamic styles #1052', function() {

    var tag = riot.mount('table-multibody')[0],
      bodies = tag.root.getElementsByTagName('tbody')

    expect(bodies.length).to.be(3)
    for (var i = 0; i < bodies.length; ++i) {
      expect(normalizeHTML(bodies[0].innerHTML))
        .to.match(/<tr style="background-color: ?(?:white|lime);?"[^>]*>(?:<td[^>]*>[A-C]\d<\/td>){3}<\/tr>/)
    }

    expect(bodies[0].getElementsByTagName('tr')[0].style.backgroundColor).to.be('white')
    tag.root.getElementsByTagName('button')[0].onclick({})
    expect(bodies[0].getElementsByTagName('tr')[0].style.backgroundColor).to.be('lime')

    tags.push(tag)
  })

  it('table with tbody and thead #1549', function() {

    var tag = riot.mount('table-thead-tfoot-nested')[0],
      bodies = tag.root.getElementsByTagName('tbody'),
      heads = tag.root.getElementsByTagName('thead'),
      foots = tag.root.getElementsByTagName('tfoot')

    expect(bodies.length).to.be(1)
    expect(heads.length).to.be(1)
    expect(foots.length).to.be(1)

    var ths = tag.root.getElementsByTagName('th'),
      trs = tag.root.getElementsByTagName('tr'),
      tds = tag.root.getElementsByTagName('td')

    expect(ths.length).to.be(3)
    expect(trs.length).to.be(5)
    expect(tds.length).to.be(6)

    tags.push(tag)
  })

  it('table with caption and looped cols, ths, and trs #1067', function() {
    var data = {
      // copied from loop-cols.tag
      headers: [
        'Name',
        'Number',
        'Address',
        'City',
        'Contact'
      ],
      data: [
        ['Abc', '10', 'A 4B', 'México', 'Juan'],
        ['Def', '20', 'B 50', 'USA', 'Anna'],
        ['Ghi', '30', 'D 60', 'Japan', ''],
        ['Jkl', '40', 'E 1C', 'France', 'Balbina']
      ]
    }
    var tag = riot.mount('loop-cols')[0],
      el, i, k

    tag.update()

    el = getEls('caption')[0]
    expect(el.innerHTML).to.be('Loop Cols')

    el = getEls('colgroup')
    expect(el.length).to.be(1)

    el = getEls('col', el[0])
    expect(el.length).to.be(5)

    el = getEls('tr', getEls('thead')[0])
    expect(el.length).to.be(1)

    el = getEls('th', el[0])
    expect(el.length).to.be(5)
    for (i = 0; i < el.length; ++i) {
      expect(el[i].tagName).to.be('TH')
      expect(el[i].innerHTML.trim()).to.be(data.headers[i])
    }

    el = getEls('tr', getEls('tbody')[0])
    expect(el.length).to.be(4)
    //console.log(' - - - tbody.tr: ' + el[0].innerHTML)

    for (i = 0; i < el.length; ++i) {
      var cells = getEls('td', el[i])
      expect(cells.length).to.be(5)
      for (k = 0; k < cells.length; ++k) {
        //console.log(' - - - getting data[' + i + ',' + k + ']')
        expect(cells[k].tagName).to.be('TD')
        expect(cells[k].innerHTML.trim()).to.be(data.data[i][k])
      }
    }

    tags.push(tag)

    function getEls(t, e) {
      if (!e) e = tag.root
      return e.getElementsByTagName(t)
    }
  })

  it('table/thead/tbody/tfoot used as root element of custom tags', function() {
    var
      tag = riot.mount('table-test')[0],
      tbl

    // set "tbl" to the table-test root element
    expect(tag).to.not.be.empty()
    tbl = tag.root
    expect(tbl).to.not.be.empty()
    tag.update()

    testTable(tbl, 'table-caption', {
      tbody: 1,
      caption: true,
      colgroup: true
    })
    testTable(tbl, 'table-colgroup', {
      thead: 1,
      tbody: 1,
      colgroup: true
    })
    testTable(tbl, 'table-looped-col', {
      thead: 1,
      tbody: 1,
      col: true
    })
    testTable(tbl, 'table-multi-col', {
      thead: 1,
      tbody: 1,
      col: true
    })
    testTable(tbl, 'table-tfoot', {
      tfoot: 1,
      tbody: 1
    })
    testTable(tbl, 'table-tr-body-only', {
      tr: 2
    })
    testTable(tbl, 'table-tr-alone', {
      tr: 1
    })
    testTable(tbl, 'table-custom-thead-tfoot', {
      thead: 1,
      tfoot: 1,
      tbody: 2,
      colgroup: true
    })

    tags.push(tag)

    // test the table and call the tests for the content
    function testTable(root, name, info) {
      var s, key, inf

      root = root.querySelectorAll('table[data-is=' + name + ']')
      s = name + '.length: '
      expect(s + root.length).to.be(s + '1')
      root = root[0]

      // test content
      for (key in info) { // eslint-disable-line
        if (info[key] === true)
          testOther(root, key)
        else
          testRows(root, key, info[key])
      }
    }

    // test rows and cells for an element of thead/tfoot/tbody
    function testRows(root, name, cnt) {
      var s, i, r, c, rows, cells, templ

      // check the count of this element
      root = root.getElementsByTagName(name)
      s = name + '.length: '
      expect(s + root.length).to.be(s + cnt)
      if (name === 'tr') {
        name = 'tbody'
        root = [{ rows: root }]
        //...and leave cnt as-is, else adjust cnt to expected rows
      } else cnt = name === 'tbody' ? 2 : 1

      // check each element
      for (i = 0; i < root.length; i++) {
        // test the rows
        rows = root[i].rows
        expect(rows.length).to.be(cnt)
        // test the cols
        for (r = 0; r < rows.length; r++) {
          c = name[1].toUpperCase()
          s = r + 1
          cells = rows[r].cells
          templ = c === 'B' ? 'R' + s + '-C' : c + '-'
          expect(cells.length).to.be(2)
          expect(cells[0].innerHTML).to.contain(templ + '1')
          expect(cells[1].innerHTML).to.contain(templ + '2')
        }
      }
    }

    // test caption, colgroup and col elements
    function testOther(root, name) {
      var cols, s = name + '.length: '

      // we'll search the parent for <col>, later in the switch
      if (name !== 'col') {
        root = root.getElementsByTagName(name)
        expect(s + root.length).to.be(s + '1')
        root = root[0]
      }
      switch (name) {
      case 'caption':
        expect(root.innerHTML).to.contain('Title')
        break
      case 'colgroup':
      case 'col':
        cols = root.getElementsByTagName('col')
        expect(cols).to.have.length(2)
        expect(cols[0].width).to.be('150')
        expect(cols[1].width).to.be('200')
        break
      default:
        break
      }
    }
  })

  it('the "shouldUpdate" locks the tag update properly', function() {
    var tag = riot.mount('should-update')[0]
    tag.update()
    expect(tag.count).to.be(0)
    tag.shouldUpdate = function() { return true }
    tag.update()
    expect(tag.count).to.be(1)
    tags.push(tag)
  })

  it('select as root element of custom riot tag', function () {
    var
      CHOOSE = 0,     // option alone
      OPTION = 1,     // looped option
      OPTGRP = 2,     // optgroup with options
      list = {
        'select-single-option': [0, CHOOSE],
        'select-each-option': [1, OPTION],
        'select-each-option-prompt': [2, CHOOSE, OPTION],
        'select-each-two-options': [4, OPTION, OPTION],
        'select-optgroup-each-option': [0, OPTGRP],
        'select-optgroup-each-option-prompt': [0, CHOOSE, OPTGRP],
        'select-two-optgroup-each-option': [3, OPTGRP, CHOOSE, OPTGRP],
        'select-each-optgroup': [0, OPTGRP, OPTGRP]
      },
      sel, dat, tag = riot.mount('select-test')[0]

    expect(tag).to.not.be.empty()
    for (var name in list) {                 // eslint-disable-line guard-for-in
      //console.log('Testing ' + name)
      dat = list[name]
      sel = tag.root.querySelector('select[data-is=' + name + ']')
      expect(sel).to.not.be.empty()
      if (sel.selectedIndex !== dat[0]) expect().fail(
        name + '.selectIndex ' + sel.selectedIndex + ' expected to be ' + dat[0])
      var s1 = listFromSel(sel)
      var s2 = listFromDat(dat)
      expect(s1).to.be(s2)
    }

    function listFromDat(dat) {
      var op = [], s = 'Opt1,Opt2,Opt3'
      for (i = 1; i < dat.length; i++) {
        if (dat[i] === OPTGRP) op.push('G,' + s)
        else if (dat[i] === OPTION) op.push(s)
        else op.push('(choose)')
      }
      return op.join(',')
    }
    function listFromSel(el) {
      var op = []
      el = el.firstChild
      while (el) {
        if (el.tagName === 'OPTGROUP') {
          op.push('G')
          op = op.concat(listFromSel(el))
        } else if (el.tagName === 'OPTION') {
          op.push(el.text)
        }
        el = el.nextSibling
      }
      return op.join(',')
    }

    tags.push(tag)
  })

  it('Passing options to the compiler through riot.compile (v2.3.12)', function () {
    var str = '<passing-options>\n  <p>\n  <\/p>\nclick(e){}\n<\/passing-options>',
      result = riot.compile(str, true, {compact: true, type: 'none'})
    expect(result).to.contain('<p></p>')          // compact: true
    expect(result).to.contain('\nclick(e){}\n')   // type: none
  })

  // scoped-css is deprecated, this test must be changed in future versions
  it('Using the `style` for set the CSS parser through riot.compile (v2.3.12)', function () {
    var str = '<style-option><style>p {top:0}<\/style>\n<\/style-option>',
      result
    result = riot.compile(str, {'style': 'scoped-css'})
    expect(result).to.match(/\[(?:data-is)="style-option"\] p ?\{top:0\}/)
  })

  it('allow passing riot.observale instances to the children tags', function() {
    var tag = riot.mount('observable-attr')[0]
    expect(tag.tags['observable-attr-child'].wasTriggered).to.be(true)
    tags.push(tag)
  })

  it('loops get rendered correctly also when riot.brackets get changed', function() {

    // change the brackets
    riot.settings.brackets = '{{ }}'
    var tag = riot.mount('loop-double-curly-brackets')[0],
      ps = tag.root.getElementsByTagName('p')

    expect(ps.length).to.be(2)
    expect(ps[0].innerHTML).to.be(ps[1].innerHTML)
    expect(ps[0].innerHTML).to.be('hello')
    tag.change()
    expect(ps.length).to.be(2)
    expect(ps[0].innerHTML).to.be(ps[1].innerHTML)
    expect(ps[0].innerHTML).to.be('hello world')

    tags.push(tag)

  })

  it('riot.compile detect changes in riot.settings.brackets', function() {
    var compiled

    // change the brackets
    riot.util.brackets.set('{{ }}')
    expect(riot.settings.brackets).to.be('{{ }}')
    compiled = riot.compile('<my>{{ time }} and { time }</my>', true)
    expect(compiled).to.contain("riot.tag2('my', '{{time}} and { time }',")

    // restore using riot.settings
    riot.settings.brackets = defaultBrackets
    compiled = riot.compile('<my>{ time } and { time }</my>', true)
    expect(riot.util.brackets.settings.brackets).to.be(defaultBrackets)
    expect(compiled).to.contain("riot.tag2('my', '{time} and {time}',")

    // change again, now with riot.settings
    riot.settings.brackets = '{{ }}'
    compiled = riot.compile('<my>{{ time }} and { time }</my>', true)
    expect(riot.util.brackets.settings.brackets).to.be('{{ }}')
    expect(compiled).to.contain("riot.tag2('my', '{{time}} and { time }',")

    riot.util.brackets.set(undefined)
    expect(riot.settings.brackets).to.be(defaultBrackets)
    compiled = riot.compile('<my>{ time } and { time }</my>', true)
    expect(compiled).to.contain("riot.tag2('my', '{time} and {time}',")
  })

  it('loops correctly on array subclasses', function() {
    var tag = riot.mount('loop-arraylike')[0],
      root = tag.root
    expect(normalizeHTML(root.getElementsByTagName('div')[0].innerHTML))
      .to.be('<p>0 = zero</p><p>1 = one</p><p>2 = two</p><p>3 = three</p>')
    tags.push(tag)
  })

  it('each custom tag with an if', function() {
    defineTag('<inner><br></inner>')
    var tag = makeTag(`
      <inner each={item in items} if={cond} />
      this.items = [1]
      this.cond = true
    `)
    expectHTML(tag).to.be('<inner><br></inner>')

    tag.update({cond: false})
    expectHTML(tag).to.be('')
    expect(tag.tags.inner).to.be(undefined)

    tag.update({cond: true})
    expectHTML(tag).to.be('<inner><br></inner>')
    expect(tag.tags.inner).not.to.be(undefined)
  })

  it('each anonymous with an if', function() {
    var tag = makeTag(`
      <div each={item, i in items} if={item.cond}>{i}</div>
      this.items = [{cond: true}, {cond: false}]
    `)
    expectHTML(tag).to.be('<div>0</div>')
    tag.items[1].cond = true
    tag.update()
    expectHTML(tag).to.be('<div>0</div><div>1</div>')
  })
  it('virtual tags mount inner content and not the virtual tag root', function() {
    var tag = riot.mount('loop-virtual')[0],
      els = tag.root.children

    expect(els[0].tagName).to.be('DT')
    expect(els[0].innerHTML).to.be('Coffee')
    expect(els[1].tagName).to.be('DD')
    expect(els[1].innerHTML).to.be('Black hot drink')
    expect(els[2].tagName).to.be('DT')
    expect(els[2].innerHTML).to.be('Milk')
    expect(els[3].tagName).to.be('DD')
    expect(els[3].innerHTML).to.be('White cold drink')

    tag.data.reverse()
    tag.update()

    expect(els[2].tagName).to.be('DT')
    expect(els[2].innerHTML).to.be('Coffee')
    expect(els[3].tagName).to.be('DD')
    expect(els[3].innerHTML).to.be('Black hot drink')
    expect(els[0].tagName).to.be('DT')
    expect(els[0].innerHTML).to.be('Milk')
    expect(els[1].tagName).to.be('DD')
    expect(els[1].innerHTML).to.be('White cold drink')

    tag.data.unshift({ key: 'Tea', value: 'Hot or cold drink' })
    tag.update()
    expect(els[0].tagName).to.be('DT')
    expect(els[0].innerHTML).to.be('Tea')
    expect(els[1].tagName).to.be('DD')
    expect(els[1].innerHTML).to.be('Hot or cold drink')
    tags.push(tag)

    injectHTML('<loop-virtual-reorder></loop-virtual-reorder>')

    var tag2 = riot.mount('loop-virtual-reorder')[0],
      els2 = tag2.root.children

    els2[0].setAttribute('test', 'ok')
    expect(els2[0].getAttribute('test')).to.be('ok')
    expect(els2[0].tagName).to.be('DT')
    expect(els2[0].innerHTML).to.be('Coffee')
    expect(els2[1].tagName).to.be('DD')
    expect(els2[1].innerHTML).to.be('Black hot drink')
    expect(els2[2].tagName).to.be('DT')
    expect(els2[2].innerHTML).to.be('Milk')
    expect(els2[3].tagName).to.be('DD')
    expect(els2[3].innerHTML).to.be('White cold drink')

    tag2.data.reverse()
    tag2.update()

    expect(els2[2].getAttribute('test')).to.be('ok')
    expect(els2[2].tagName).to.be('DT')
    expect(els2[2].innerHTML).to.be('Coffee')
    expect(els2[3].tagName).to.be('DD')
    expect(els2[3].innerHTML).to.be('Black hot drink')
    expect(els2[0].tagName).to.be('DT')
    expect(els2[0].innerHTML).to.be('Milk')
    expect(els2[1].tagName).to.be('DD')
    expect(els2[1].innerHTML).to.be('White cold drink')
    tags.push(tag2)


  })

  it('mount search data-is attributes for tag names only #1463', function () {
    var
      names = ['x-my_tag1', 'x-my-tag2', 'x-my-3tag', 'x-m1-3tag'],
      templ = '<@>X</@>',
      i, el, tag, name

    // test browser capability for match unquoted chars in [-_A-Z]
    for (i = 0; i < names.length; ++i) {
      el = appendTag('div', {'data-is': names[i]})
      riot.compile(templ.replace(/@/g, names[i]))
      tag = riot.mount(names[i])[0]
      tags.push(tag)
      tag = $('*[data-is=' + names[i] + ']')
      expect(tag.innerHTML).to.be('X')
    }

    // double quotes work, we can't mount html element named "22"
    name = 'x-my-tag3'
    el = appendTag(name, {name: '22'})
    riot.compile(templ.replace(/@/g, name))
    tag = riot.mount('*[name="22"]')[0]
    tags.push(tag)
    tag = $(name)
    expect(tag.innerHTML).to.be('X')
  })

  it('nested virtual tags unmount properly', function() {
    injectHTML('<virtual-nested-unmount></virtual-nested-unmount>')
    var tag = riot.mount('virtual-nested-unmount')[0]
    var spans = tag.root.querySelectorAll('span')
    var divs = tag.root.querySelectorAll('div')
    expect(spans.length).to.be(6)
    expect(divs.length).to.be(3)
    expect(spans[0].innerHTML).to.be('1')
    expect(spans[1].innerHTML).to.be('1')
    expect(spans[2].innerHTML).to.be('2')
    expect(spans[3].innerHTML).to.be('1')
    expect(spans[4].innerHTML).to.be('2')
    expect(spans[5].innerHTML).to.be('3')
    expect(divs[0].innerHTML).to.be('1')
    expect(divs[1].innerHTML).to.be('2')
    expect(divs[2].innerHTML).to.be('3')

    tag.childItems = [
      {title: '4', childchildItems: ['1', '2', '3', '4']},
      {title: '5', childchildItems: ['1', '2', '3', '4', '5']}
    ]
    tag.update()
    spans = tag.root.querySelectorAll('span')
    divs = tag.root.querySelectorAll('div')
    expect(spans.length).to.be(9)
    expect(divs.length).to.be(2)
    expect(spans[0].innerHTML).to.be('1')
    expect(spans[1].innerHTML).to.be('2')
    expect(spans[2].innerHTML).to.be('3')
    expect(spans[3].innerHTML).to.be('4')
    expect(spans[4].innerHTML).to.be('1')
    expect(spans[5].innerHTML).to.be('2')
    expect(spans[6].innerHTML).to.be('3')
    expect(spans[7].innerHTML).to.be('4')
    expect(spans[8].innerHTML).to.be('5')
    expect(divs[0].innerHTML).to.be('4')
    expect(divs[1].innerHTML).to.be('5')

    tags.push(tag)
  })

  it('still loops with reserved property names #1526', function() {
    var tag = riot.mount('reserved-names')[0]
    tag.reorder()
    tag.update()
    tag.reorder()
    tag.update()
    tags.push(tag)
  })

  it('named elements in object key loop do not duplicate', function() {

    var tag = riot.mount('obj-key-loop')[0]

    expect(tag.x.value).to.be('3')
    expect(tag.y.value).to.be('44')
    expect(tag.z.value).to.be('23')

    tag.update()
    expect(tag.x.value).to.be('3')
    expect(tag.y.value).to.be('44')
    expect(tag.z.value).to.be('23')

    tags.push(tag)
  })

  it('render tag: input,option,textarea tags having expressions as value', function() {
    injectHTML('<form-controls></form-controls>')
    var val = 'my-value',
      tag = riot.mount('form-controls', { text: val })[0],
      root = tag.root

    expect(root.querySelector('input[type="text"]').value).to.be(val)
    expect(root.querySelector('select option[selected]').value).to.be(val)
    expect(root.querySelector('textarea[name="txta1"]').value).to.be(val)
    expect(root.querySelector('textarea[name="txta2"]').value).to.be('')
    if (IE_VERSION !== 9) expect(root.querySelector('textarea[name="txta2"]').placeholder).to.be(val)

    tags.push(tag)
  })

  it('support `data-is` for html5 compliance', function() {
    injectHTML('<div data-is="tag-data-is"></div>')
    var tag = riot.mount('tag-data-is')[0]
    var els = tag.root.getElementsByTagName('p')
    expect(els.length).to.be(2)
    expect(els[0].innerHTML).to.contain('html5')
    expect(els[1].innerHTML).to.contain('too')
    tags.push(tag)
  })

  it('tag names are case insensitive (converted to lowercase) in `riot.mount`', function() {
    var i, els = document.querySelectorAll('tag-data-is,[data-is="tag-data-is"]')
    for (i = 0; i < els.length; i++) {
      els[i].parentNode.removeChild(els[i])
    }
    injectHTML('<div data-is="tag-data-is"></div>')
    injectHTML('<tag-DATA-Is></tag-DATA-Is>')
    var tags = riot.mount('tag-Data-Is')

    expect(tags.length).to.be(2)
    expect(tags[0].root.getElementsByTagName('p').length).to.be(2)
    expect(tags[1].root.getElementsByTagName('p').length).to.be(2)
    tags.push(tags[0], tags[1])
  })

  it('the value of the `data-is` attribute needs lowercase names', function() {
    var i, els = document.querySelectorAll('tag-data-is,[data-is="tag-data-is"]')
    for (i = 0; i < els.length; i++) {
      els[i].parentNode.removeChild(els[i])
    }
    injectHTML('<div data-is="tag-DATA-Is"></div>')
    var tags = riot.mount('tag-Data-Is')

    expect(tags.length).to.be(0)
  })

  it('component nested in virtual unmounts correctly', function() {
    injectHTML('<virtual-nested-component></virtual-nested-component>')
    var tag = riot.mount('virtual-nested-component')[0]
    var components = tag.root.querySelectorAll('not-virtual-component2')
    expect(components.length).to.be(4)

    tag.unmount()
    components = tag.root.querySelectorAll('not-virtual-component2')
    expect(components.length).to.be(0)

    tags.push(tag)

  })

  it('non looped and conditional virtual tags mount content', function() {
    injectHTML('<virtual-no-loop></virtual-no-loop>')
    var tag = riot.mount('virtual-no-loop')[0]

    var virts = tag.root.querySelectorAll('virtual')
    expect(virts.length).to.be(0)

    var spans = tag.root.querySelectorAll('span')
    var divs = tag.root.querySelectorAll('div')
    expect(spans.length).to.be(2)
    expect(divs.length).to.be(2)
    expect(spans[0].innerHTML).to.be('if works text')
    expect(divs[0].innerHTML).to.be('yielded text')
    expect(spans[1].innerHTML).to.be('virtuals yields expression')
    expect(divs[1].innerHTML).to.be('hello there')


    tags.push(tag)
  })

  it('virtual tags with yielded content function in a loop', function() {
    injectHTML('<virtual-yield-loop></virtual-yield-loop>')
    var tag = riot.mount('virtual-yield-loop')[0]
    var spans = tag.root.querySelectorAll('span')

    expect(spans[0].innerHTML).to.be('one')
    expect(spans[1].innerHTML).to.be('two')
    expect(spans[2].innerHTML).to.be('three')

    tag.items.reverse()
    tag.update()

    spans = tag.root.querySelectorAll('span')

    expect(spans[0].innerHTML).to.be('three')
    expect(spans[1].innerHTML).to.be('two')
    expect(spans[2].innerHTML).to.be('one')

    tags.push(tag)
  })

  it('data-is can be dynamically created by expression', function() {
    injectHTML('<dynamic-data-is></dynamic-data-is>')
    var tag = riot.mount('dynamic-data-is')[0]
    var divs = tag.root.querySelectorAll('div')
    expect(divs[0].querySelector('input').getAttribute('type')).to.be('color')
    expect(divs[1].querySelector('input').getAttribute('type')).to.be('color')
    expect(divs[2].querySelector('input').getAttribute('type')).to.be('date')
    expect(divs[3].querySelector('input').getAttribute('type')).to.be('date')

    tag.single = 'color'
    tag.update()
    expect(divs[3].querySelector('input').getAttribute('type')).to.be('color')

    tag.intags.reverse()
    tag.update()
    divs = tag.root.querySelectorAll('div')
    expect(divs[0].querySelector('input').getAttribute('type')).to.be('date')
    expect(divs[1].querySelector('input').getAttribute('type')).to.be('color')
    expect(divs[2].querySelector('input').getAttribute('type')).to.be('color')


    tags.push(tag)
  })
})