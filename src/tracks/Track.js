import {registerTooltip} from '../behaviors/tooltip'
import {registerSelectAction} from '../behaviors/selectaction.js'
import {dispatch} from 'd3-dispatch'
import {arc} from 'd3-shape'
import {select, event} from 'd3-selection'
import {getConf} from '../config-utils'
import {buildScale} from '../utils'
import {buildColorValue} from '../colors'
import {renderAxesLabels, renderAxes} from '../axes'

const uuidv4 = require('uuid/v4');

/**
 * Abstract class used by all tracks
**/
export default class Track {
  constructor (instance, conf, defaultConf, data, dataParser) {
    this.dispatch = dispatch('mouseover', 'mouseout', 'mouseclick')
    this.parseData = dataParser
    this.loadData(data, instance)
    this.conf = getConf(conf, defaultConf, this.meta, instance)
    this.conf.colorValue = buildColorValue(
      this.conf.color,
      this.conf.cmin,
      this.conf.cmax,
      this.conf.logScale,
      this.conf.logScaleBase
    )
    this.scale = buildScale(
      this.conf.cmin,
      this.conf.cmax,
      this.conf.outerRadius - this.conf.innerRadius,
      this.conf.logScale,
      this.conf.logScaleBase
    )
  }

  loadData (data, instance) {
    const result = this.parseData(data, instance._layout.summary())
    this.data = result.data
    this.meta = result.meta
  }

  render (instance, parentElement, name) {
    parentElement.select('.' + name).remove()
    const track = parentElement.append('g')
      .attr('class', name)
      .attr('z-index', this.conf.zIndex)

    this.renderTrackLabel(track, instance._layout, this.conf)
    if (this.conf.axes && this.conf.axes.length > 0) {
      renderAxesLabels(track, this.conf, instance._layout, this.scale); //Do this before generating datumContainer, otherwise it will repeat the axes labels for each block rendered
    }
    const datumContainer = this.renderBlock(track, this.data, instance._layout, this.conf)
    if (this.conf.axes && this.conf.axes.length > 0) {
      renderAxes(datumContainer, this.conf, instance, this.scale)
    }
    const selection = this.renderDatum(datumContainer, this.conf, instance._layout)
    if (this.conf.tooltipContent) {
      registerTooltip(this, instance, selection, this.conf)
    }
    if (this.conf.selectAction) {
        registerSelectAction(this, instance, selection, this.conf);
    }
    selection.on('mouseover', (d, i) => {
      this.dispatch.call('mouseover', this, d)
      if (this.conf.tooltipContent) {
        instance.clipboard.attr('value', this.conf.tooltipContent(d))
      }
    })
    selection.on('mouseout', (d, i) => {
      this.dispatch.call('mouseout', this, d)
    })
    selection.on('click', (d,i) => {
      this.dispatch.call('mouseclick', this, d)
    })

    Object.keys(this.conf.events).forEach((eventName) => {
      const conf = this.conf
      selection.on(eventName, function (d, i, nodes) { conf.events[eventName](d, i, nodes, event) })
    })

    return this
  }

  renderBlock (parentElement, data, layout, conf) {
    const block = parentElement.selectAll('.block')
      .data(data)
      .enter().append('g')
      .attr('class', 'block')
      .attr(
        'transform',
        (d) => `rotate(${layout.blocks[d.key].start * 360 / (2 * Math.PI)})`
      )

    if (conf.backgrounds) {
      block.selectAll('.background')
        .data((d) => {
          return conf.backgrounds.map((background) => {
            return {
              start: background.start || conf.cmin,
              end: background.end || conf.cmax,
              angle: layout.blocks[d.key].end - layout.blocks[d.key].start,
              color: background.color,
              opacity: background.opacity
            }
          })
        })
        .enter().append('path')
        .attr('class', 'background')
        .attr('fill', (background) => background.color)
        .attr('opacity', (background) => background.opacity || 1)
        .attr('d', arc()
          .innerRadius((background) => {
            return conf.direction === 'in'
              ? conf.outerRadius - this.scale(background.start)
              : conf.innerRadius + this.scale(background.start)
          })
          .outerRadius((background) => {
            return conf.direction === 'in'
              ? conf.outerRadius - this.scale(background.end)
              : conf.innerRadius + this.scale(background.end)
          })
          .startAngle(0)
          .endAngle((d) => d.angle)
        )
    }

    return block
  }

  //Intended to be overwritten by children classes to modify the label/labelPath attributes -- CSS cannot modify these,
  //but just styling elements
  renderTrackLabelAddendum(label, labelPath) {
      return;
  }

  renderTrackLabel (parentElement, layout, conf) {
      //If the layout defines a block id to contain track labels
      if((layout.conf.trackLabelBlockId !== undefined) && (layout.conf.trackLabelBlockId in layout.blocks)) {
          if( ("trackLabelConf" in conf) && ("label" in conf.trackLabelConf) && (conf.trackLabelConf.label !== undefined) ) {
            const labelBlock = parentElement.append('g')
                                    .attr('class', 'label-block')
                                    .attr('transform', `rotate(${layout.blocks[layout.conf.trackLabelBlockId].start * 360 / (2 * Math.PI)})`)
            const radius = (conf.innerRadius + conf.outerRadius)/2
            const arcid = 'arcid-' + uuidv4()
            labelBlock.append('path')
                      .attr('class', 'label-arcpath')
                      .attr('fill', 'none')
                      .attr('stroke', 'none')
                      .attr('opacity', 1)
                      .attr('d', arc()
                          .innerRadius(radius)
                          .outerRadius(radius)
                          .startAngle(0)
                          .endAngle(layout.blocks[layout.conf.trackLabelBlockId].end - layout.blocks[layout.conf.trackLabelBlockId].start)
                      )
                      .attr('id', arcid)

            const label = labelBlock.append('text')
                .attr('class', conf.trackLabelConf.class)
                .attr('text-anchor', 'start')

            // http://stackoverflow.com/questions/20447106/how-to-center-horizontal-and-vertical-text-along-an-textpath-inside-an-arc-usi
            const labelPath = label.append('textPath')
                                   .attr('startOffset', '0%')
                                   .attr('xlink:href', '#' + arcid)
                                   .text(conf.trackLabelConf.label)
            this.renderTrackLabelAddendum(label, labelPath)
          }
      }
  }

  theta (position, block) {
    return position / block.len * (block.end - block.start)
  }

  x (d, layout, conf) {
    const height = this.scale(d.value)
    const r = conf.direction === 'in'
      ? conf.outerRadius - height : conf.innerRadius + height

    const angle = this.theta(d.position, layout.blocks[d.block_id]) - Math.PI / 2
    return r * Math.cos(angle)
  }

  y (d, layout, conf) {
    const height = this.scale(d.value)
    const r = conf.direction === 'in'
      ? conf.outerRadius - height : conf.innerRadius + height

    const angle = this.theta(d.position, layout.blocks[d.block_id]) - Math.PI / 2
    return r * Math.sin(angle)
  }
}
