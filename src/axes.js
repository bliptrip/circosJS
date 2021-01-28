import range from 'lodash/range'
import reduce from 'lodash/reduce'
import {arc} from 'd3-shape'
import logger from './logger'

const uuidv4 = require('uuid/v4');

const _buildAxisData = (value, axesGroup, conf) => {
  return {
    value: value,
    thickness: axesGroup.thickness || 1,
    color: axesGroup.color || '#d3d3d3',
    opacity: axesGroup.opacity || conf.opacity
  }
}

export const _buildAxesData = (conf) => {
  return reduce(conf.axes, (aggregator, axesGroup) => {
    if (!axesGroup.position && !axesGroup.spacing) {
      logger.warn('Skipping axe group with no position and spacing defined')
      return aggregator
    }
    if (axesGroup.position) {
      aggregator.push(_buildAxisData(axesGroup.position, axesGroup, conf))
    }
    if (axesGroup.spacing) {
      const builtAxes = range(
        axesGroup.start || conf.cmin,
        axesGroup.end || conf.cmax,
        axesGroup.spacing
      )
        .map((value) => {
          return _buildAxisData(value, axesGroup, conf)
        })
      return aggregator.concat(builtAxes)
    }
    return aggregator
  }, [])
}

export const renderAxes = (parentElement, conf, instance, scale) => {
  const axes         = _buildAxesData(conf)
  const layout       = instance._layout;

  //Code to handle axis labels
  if((layout.conf.trackLabelBlockId !== undefined) && (layout.conf.trackLabelBlockId in layout.blocks)) {
    const labelBlock = parentElement.select(function () { return this.parentNode; })
                        .append('g')
                        .attr('class', 'label-axes-block')
                        .attr('transform', `rotate(${layout.blocks[layout.conf.trackLabelBlockId].start * 360 / (2 * Math.PI)})`)
    conf.axes.forEach( (a,i) => {
            const radius = conf.direction === 'in' ? (conf.outerRadius - scale(axes[i].value)) : (conf.innerRadius + scale(axes[i].value))
            if( ("axisLabelConf" in a) && ("label" in a.axisLabelConf) && (a.axisLabelConf.label !== undefined) ) {
                const arcid = 'arcid-' + uuidv4()
                const axisBlock = labelBlock.append('g')
                    .attr('class', 'label-axis-block')
                axisBlock.append('path')
                        .attr('class', 'label-axis-arcpath')
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
                const label = axisBlock.append('text')
                    .attr('class', a.axisLabelConf.class)
                    .attr('text-anchor', 'end')


                // http://stackoverflow.com/questions/20447106/how-to-center-horizontal-and-vertical-text-along-an-textpath-inside-an-arc-usi
                const labelPath = label.append('textPath')
                                    .attr('startOffset', '50%')
                                    .attr('xlink:href', '#' + arcid)
                                    .text(a.axisLabelConf.label)
            }
    });
  }

  const axis = arc()
    .innerRadius((d) => {
      return conf.direction === 'in'
        ? conf.outerRadius - scale(d.value)
        : conf.innerRadius + scale(d.value)
    })
    .outerRadius((d) => {
      return conf.direction === 'in'
        ? conf.outerRadius - scale(d.value)
        : conf.innerRadius + scale(d.value)
    })
    .startAngle(0)
    .endAngle((d) => d.length)

  const selection = parentElement
    .selectAll('.axis')
      .data((blockData) => {
        const block = instance._layout.blocks[blockData.key]
        return axes.map((d) => {
          return {
            value: d.value,
            thickness: d.thickness,
            color: d.color,
            opacity: d.opacity,
            block_id: blockData.key,
            length: block.end - block.start
          }
        })
      })
    .enter()
    .append('path')
      .attr('opacity', (d) => d.opacity)
      .attr('class', 'axis')
      .attr('d', axis)
      .attr('stroke-width', (d) => d.thickness)
      .attr('stroke', (d) => d.color)

  if (conf.showAxesTooltip) {
    selection.on('mouseover', (d, i) => {
      instance.tip
        .html(d.value)
        .transition()
        .style('opacity', 0.9)
        .style('left', (event.pageX) + 'px')
        .style('top', (event.pageY - 28) + 'px')
    })
    selection.on('mouseout', (d, i) => {
      instance.tip
        .transition()
        .duration(500)
        .style('opacity', 0)
    })
  }

  return selection
}
