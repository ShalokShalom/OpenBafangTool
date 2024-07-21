import React from 'react';
import {
    Typography,
    Descriptions,
    FloatButton,
    message,
    Radio,
    Switch,
    Popconfirm,
} from 'antd';
import type { DescriptionsProps } from 'antd';
import { SyncOutlined, DeliveredProcedureOutlined } from '@ant-design/icons';
import BafangUartMotor from '../../../../../device/high-level/BafangUartMotor';
import {
    BafangUartMotorBasicParameters,
    BafangUartMotorInfo,
    BafangUartMotorPedalParameters,
    BafangUartMotorThrottleParameters,
    ParameterNames,
    PedalSensorSignals,
    SimplifiedPedalSpeedLimitOptions,
    SpeedLimitByDisplay,
    ThrottleMode,
    ThrottleModeOptions,
} from '../../../../../types/BafangUartMotorTypes';
import { lowVoltageLimits } from '../../../../../constants/parameter_limits';
import ParameterInputComponent from '../../../../components/ParameterInput';
import {
    generateEditableNumberListItemWithWarning,
    generateSimpleStringListItem,
} from '../../../../utils/UIUtils';
import AssistLevelTableComponent from '../../../../components/AssistLevelTableComponent';
import SelectParameterComponent from '../../../../components/SelectParameterComponent';
import i18n from '../../../../../i18n/i18n';

const { Title } = Typography;

type SettingsProps = {
    connection: BafangUartMotor;
};

type SettingsState = BafangUartMotorInfo &
    BafangUartMotorBasicParameters &
    BafangUartMotorPedalParameters &
    BafangUartMotorThrottleParameters & {
        lastUpdateTime: number;
        throttle_on: boolean;
    };

/* eslint-disable camelcase */
class BafangUartMotorSettingsSimplifiedView extends React.Component<
    SettingsProps,
    SettingsState
> {
    private initial_info: BafangUartMotorInfo;

    private initial_basic_parameters: BafangUartMotorBasicParameters;

    private initial_pedal_parameters: BafangUartMotorPedalParameters;

    private initial_throttle_parameters: BafangUartMotorThrottleParameters;

    private packages_written: number;

    constructor(props: SettingsProps) {
        super(props);
        const { connection } = this.props;
        this.initial_info = connection.getInfo();
        this.initial_basic_parameters = connection.getBasicParameters();
        this.initial_pedal_parameters = connection.getPedalParameters();
        this.initial_throttle_parameters = connection.getThrottleParameters();
        this.packages_written = 0;
        this.state = {
            ...this.initial_info,
            ...this.initial_basic_parameters,
            ...this.initial_pedal_parameters,
            ...this.initial_throttle_parameters,
            lastUpdateTime: 0,
            throttle_on:
                this.initial_throttle_parameters.throttle_start_voltage <
                this.initial_throttle_parameters.throttle_end_voltage,
        };
        this.getInfoItems = this.getInfoItems.bind(this);
        this.getElectricalParameterItems =
            this.getElectricalParameterItems.bind(this);
        this.getPhysicalParameterItems =
            this.getPhysicalParameterItems.bind(this);
        this.getDriveParameterItems = this.getDriveParameterItems.bind(this);
        this.getThrottleItems = this.getThrottleItems.bind(this);
        this.saveParameters = this.saveParameters.bind(this);
        this.updateData = this.updateData.bind(this);
        this.onWriteSuccess = this.onWriteSuccess.bind(this);
        this.onWriteError = this.onWriteError.bind(this);
        connection.emitter.removeAllListeners('write-success');
        connection.emitter.removeAllListeners('write-error');
        connection.emitter.on('data', this.updateData);
        connection.emitter.on('write-success', this.onWriteSuccess);
        connection.emitter.on('write-error', this.onWriteError);
    }

    onWriteSuccess(pkg_code: string): void {
        // eslint-disable-next-line react/destructuring-assignment, react/no-access-state-in-setstate
        this.packages_written++;
        message.success(`${ParameterNames[pkg_code]} written successfull`);
    }

    onWriteError(parameter_code: string): void {
        message.error(`${ParameterNames[parameter_code]} write error`);
    }

    getInfoItems(): DescriptionsProps['items'] {
        const { connection } = this.props;
        const info = connection.getInfo();
        return [
            generateSimpleStringListItem(
                i18n.t('serial_number'),
                info.serial_number,
                i18n.t('serial_number_warning'),
            ),
            generateSimpleStringListItem('Voltage', info.voltage),
            generateSimpleStringListItem(
                'Max current',
                info.max_current,
                'Note, that Voltage*Max Current is a maximal power, but not nominal. If you have legal motor certified as 250W, and Voltage*Max Current is twice or even triple bigger its normal - 250W is a nominal (continuous) power, and its legal to use device that can have bigger maximal power. For example, some of Shimano STEPS motors that certified for 250W pedelecs have 600W of max power.',
            ),
        ];
    }

    getElectricalParameterItems(): DescriptionsProps['items'] {
        const { voltage, low_battery_protection } = this.state;

        return [
            {
                key: 'low_voltage_protection',
                label: (
                    <>
                        Battery cutoff voltage
                        <br />
                        <br />
                        <Typography.Text italic>
                            Increase it if you system shuts down unexpectedly by
                            BMS inside of battery
                        </Typography.Text>
                    </>
                ),
                children: (
                    <ParameterInputComponent
                        value={low_battery_protection}
                        unit="V"
                        min={lowVoltageLimits[voltage].min}
                        max={lowVoltageLimits[voltage].max}
                        onNewValue={(e) => {
                            this.setState({
                                low_battery_protection: e,
                            });
                        }}
                    />
                ),
            },
        ];
    }

    getPhysicalParameterItems(): DescriptionsProps['items'] {
        return [
            generateEditableNumberListItemWithWarning(
                'Wheel diameter',
                this.state.wheel_diameter,
                'Usually bike wheels has size in range from 12 to 29 inches',
                12,
                29,
                (wheel_diameter) => this.setState({ wheel_diameter }),
                '″',
                1,
                100,
            ),
        ];
    }

    getDriveParameterItems(): DescriptionsProps['items'] {
        const {
            pedal_speed_limit,
            pedal_signals_before_start,
            pedal_time_to_stop,
            pedal_type,
        } = this.state;
        return [
            {
                key: 'pedal_speed_limit',
                label: (
                    <>
                        Pedal speed limit
                        <br />
                        <br />
                        <Typography.Text italic>
                            Note that its illegal to set bigger speed limit that
                            <br />
                            its allowed in your country. Check your local laws
                            <br />
                            before changing it
                        </Typography.Text>
                    </>
                ),
                children: (
                    <SelectParameterComponent
                        value={pedal_speed_limit}
                        options={[
                            {
                                value: this.initial_pedal_parameters
                                    .pedal_speed_limit,
                                label: `Leave old value -&nbsp;
                                        ${
                                            this.initial_pedal_parameters
                                                .pedal_speed_limit ===
                                            SpeedLimitByDisplay
                                                ? 'By display'
                                                : `${this.initial_pedal_parameters.pedal_speed_limit} ${i18n.t('km/h')}`
                                        }`,
                            },
                            ...SimplifiedPedalSpeedLimitOptions,
                        ]}
                        onChange={(e) => {
                            this.setState({
                                pedal_speed_limit: e as number,
                            });
                        }}
                    />
                ),
            },
            {
                key: 'signals_before_assist',
                label: (
                    <>
                        Start Degree
                        <br />
                        <br />
                        <Typography.Text italic>
                            This parameter means on how big angle do you have to
                            turn pedals to start motor
                        </Typography.Text>
                    </>
                ),
                children: (
                    <Radio.Group
                        onChange={(e) => {
                            this.setState({
                                pedal_signals_before_start: e.target.value,
                            });
                        }}
                        value={pedal_signals_before_start}
                        disabled={pedal_type < 1 || pedal_type > 3}
                    >
                        <Radio
                            value={
                                this.initial_pedal_parameters
                                    .pedal_signals_before_start
                            }
                        >
                            Leave old value -&nbsp;
                            {(360 / PedalSensorSignals[pedal_type]) *
                                this.initial_pedal_parameters
                                    .pedal_signals_before_start}
                            °
                        </Radio>
                        <Radio value={PedalSensorSignals[pedal_type] / 4}>
                            90°
                        </Radio>
                        <Radio value={PedalSensorSignals[pedal_type] / 2}>
                            180°
                        </Radio>
                        <Radio
                            value={270 / (360 / PedalSensorSignals[pedal_type])}
                        >
                            270°
                        </Radio>
                    </Radio.Group>
                ),
            },
            {
                key: 'time_before_end_of_assist',
                label: (
                    <>
                        Stop Delay
                        <br />
                        <br />
                        <Typography.Text italic>
                            This parameter means time between last signal from
                            pedal sensor and motor stop. If parameter is too
                            low, motor may work unstable on low cadence. If
                            parameter is too big, braking distance will increase
                            (so too big value is not available in Simplified
                            mode)
                        </Typography.Text>
                    </>
                ),
                children: (
                    <Radio.Group
                        onChange={(e) => {
                            this.setState({
                                pedal_time_to_stop:
                                    e.target.value - (e.target.value % 10),
                            });
                        }}
                        value={pedal_time_to_stop}
                    >
                        <Radio
                            value={
                                this.initial_pedal_parameters.pedal_time_to_stop
                            }
                        >
                            Leave old value -&nbsp;
                            {this.initial_pedal_parameters.pedal_time_to_stop}
                            ms
                        </Radio>
                        <Radio value={50}>50ms</Radio>
                        <Radio value={100}>100ms</Radio>
                        <Radio value={150}>150ms</Radio>
                        <Radio value={200}>200ms</Radio>
                        <Radio value={250}>250ms</Radio>
                    </Radio.Group>
                ),
            },
        ];
    }

    getThrottleItems(): DescriptionsProps['items'] {
        const {
            throttle_start_voltage,
            throttle_end_voltage,
            throttle_mode,
            throttle_speed_limit,
        } = this.state;
        return [
            {
                key: 'throttle_start_voltage',
                label: (
                    <>
                        Throttle start voltage
                        <br />
                        <br />
                        <Typography.Text italic>
                            This parameter means voltage from throttle lever
                            that will start motor
                        </Typography.Text>
                    </>
                ),
                children: (
                    <ParameterInputComponent
                        value={throttle_start_voltage}
                        unit="V"
                        min={1}
                        max={4.2}
                        onNewValue={(e) => {
                            this.setState({
                                throttle_start_voltage: e,
                            });
                        }}
                        warningText="Its not recommended to set lower start voltage than 1.1V"
                        warningBelow={1.1}
                        decimalPlaces={1}
                    />
                ),
            },
            {
                key: 'throttle_end_voltage',
                label: (
                    <>
                        Throttle end voltage
                        <br />
                        <br />
                        <Typography.Text italic>
                            This parameter means maximal voltage from throttle
                            lever
                        </Typography.Text>
                    </>
                ),
                children: (
                    <ParameterInputComponent
                        value={throttle_end_voltage}
                        unit="V"
                        min={1}
                        max={4.2}
                        onNewValue={(e) => {
                            this.setState({
                                throttle_end_voltage: e,
                            });
                        }}
                        decimalPlaces={1}
                    />
                ),
            },
            {
                key: 'throttle_mode',
                label: (
                    <>
                        Throttle mode
                        <br />
                        <br />
                        <Typography.Text italic>
                            This parameter if throttle lever will control speed
                            or current
                        </Typography.Text>
                    </>
                ),
                children: (
                    <SelectParameterComponent
                        value={throttle_mode}
                        options={ThrottleModeOptions}
                        onChange={(e) =>
                            this.setState({ throttle_mode: e as ThrottleMode })
                        }
                    />
                ),
            },
            {
                key: 'throttle_speed_limit',
                label: 'Throttle speed limit',
                children: (
                    <Radio.Group
                        onChange={(e) => {
                            this.setState({
                                throttle_speed_limit: e.target.value,
                            });
                        }}
                        value={throttle_speed_limit}
                    >
                        <Radio
                            value={
                                this.initial_throttle_parameters
                                    .throttle_speed_limit
                            }
                        >
                            Leave old value -&nbsp;
                            {this.initial_throttle_parameters
                                .throttle_speed_limit === SpeedLimitByDisplay
                                ? 'By display'
                                : `${this.initial_throttle_parameters.throttle_speed_limit} ${i18n.t('km/h')}`}
                        </Radio>
                        <Radio value={25}>25 km/h</Radio>
                        <Radio value={32}>32 km/h</Radio>
                        <Radio value={SpeedLimitByDisplay}>
                            By limit in display module
                        </Radio>
                    </Radio.Group>
                ),
            },
        ];
    }

    updateData(): void {
        const { connection } = this.props;
        this.initial_info = connection.getInfo();
        this.initial_basic_parameters = connection.getBasicParameters();
        this.initial_pedal_parameters = connection.getPedalParameters();
        this.initial_throttle_parameters = connection.getThrottleParameters();
        this.setState({
            ...this.initial_info,
            ...this.initial_basic_parameters,
            ...this.initial_pedal_parameters,
            ...this.initial_throttle_parameters,
            lastUpdateTime: Date.now(),
        });
        console.log(
            'updated',
            this.initial_info,
            this.initial_basic_parameters,
            this.initial_pedal_parameters,
            this.initial_throttle_parameters,
        );
    }

    saveParameters(): void {
        const { connection } = this.props;
        const info: BafangUartMotorInfo = this.state as BafangUartMotorInfo;
        const basic_parameters: BafangUartMotorBasicParameters = this
            .state as BafangUartMotorBasicParameters;
        const pedal_parameters: BafangUartMotorPedalParameters = this
            .state as BafangUartMotorPedalParameters;
        const throttle_parameters: BafangUartMotorThrottleParameters = this
            .state as BafangUartMotorThrottleParameters;
        connection.setSerialNumber(info.serial_number);
        connection.setBasicParameters(basic_parameters);
        connection.setPedalParameters(pedal_parameters);
        connection.setThrottleParameters(throttle_parameters);
        this.packages_written = 0;
        connection.saveData();
        setTimeout(() => {
            if (this.packages_written === 3) {
                message.success('Parameters saved successfully!');
            } else {
                message.error('Error during writing!');
            }
        }, 3000);
    }

    render() {
        const { connection } = this.props;
        const { throttle_on } = this.state;
        return (
            <div style={{ margin: '36px' }}>
                <Typography.Title level={2} style={{ margin: 0 }}>
                    Settings
                </Typography.Title>
                <br />
                <br />
                <Descriptions
                    bordered
                    title="Info"
                    items={this.getInfoItems()}
                    column={1}
                    style={{ marginBottom: '20px' }}
                />
                <Descriptions
                    bordered
                    title="Electrical parameters"
                    items={this.getElectricalParameterItems()}
                    column={1}
                    style={{ marginBottom: '20px' }}
                />
                <Descriptions
                    bordered
                    title="Physical parameters"
                    items={this.getPhysicalParameterItems()}
                    column={1}
                    style={{ marginBottom: '20px' }}
                />
                <Title level={5}>Assist levels</Title>
                <AssistLevelTableComponent
                    assist_profiles={this.state.assist_profiles}
                    onChange={(assist_profiles) =>
                        this.setState({ assist_profiles })
                    }
                    zero_level
                />
                <Descriptions
                    bordered
                    title="Drive parameters"
                    items={this.getDriveParameterItems()}
                    column={1}
                    style={{ marginBottom: '20px' }}
                />
                <Typography.Title level={5} style={{ margin: 0 }}>
                    Turn throttle on
                </Typography.Title>
                <Typography.Text italic>
                    (WARNING! Its illegal in most countries, check your local
                    rules before installing throttle lever!) &nbsp;&nbsp;
                </Typography.Text>
                <Switch
                    checked={throttle_on}
                    onChange={(value) => {
                        this.setState({
                            throttle_on: value,
                            throttle_start_voltage: value
                                ? this.initial_throttle_parameters
                                      .throttle_start_voltage
                                : this.initial_throttle_parameters
                                      .throttle_end_voltage,
                            throttle_end_voltage:
                                this.initial_throttle_parameters
                                    .throttle_end_voltage,
                        });
                    }}
                />
                {throttle_on && (
                    <>
                        <br />
                        <br />
                        <Descriptions
                            bordered
                            items={this.getThrottleItems()}
                            column={1}
                        />
                    </>
                )}
                <FloatButton
                    icon={<SyncOutlined />}
                    type="primary"
                    style={{ right: 94 }}
                    onClick={() => {
                        connection.loadData();
                        message.open({
                            key: 'loading',
                            type: 'loading',
                            content: i18n.t('loading'),
                        });
                        setTimeout(() => {
                            const { lastUpdateTime } = this.state;
                            if (Date.now() - lastUpdateTime < 3000) {
                                message.open({
                                    key: 'loading',
                                    type: 'success',
                                    content: 'Read sucessfully!',
                                    duration: 2,
                                });
                            } else {
                                message.open({
                                    key: 'loading',
                                    type: 'error',
                                    content: 'Error during reading!',
                                    duration: 2,
                                });
                            }
                        }, 3000);
                    }}
                />
                <Popconfirm
                    title="Parameter writing"
                    description="Are you sure that you want to write all parameters on device?"
                    onConfirm={this.saveParameters}
                    okText={i18n.t('yes')}
                    cancelText={i18n.t('no')}
                >
                    <FloatButton
                        icon={<DeliveredProcedureOutlined />}
                        type="primary"
                        style={{ right: 24 }}
                    />
                </Popconfirm>
            </div>
        );
    }
}

export default BafangUartMotorSettingsSimplifiedView;
